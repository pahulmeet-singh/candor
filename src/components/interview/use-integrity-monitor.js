"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toObservations } from "@/lib/integrity/face-source";
import { isLookingAway } from "@/lib/integrity/head-pose";
import { EventOutbox, postBatchTo } from "@/lib/integrity/outbox";
import { IntegrityTracker } from "@/lib/integrity/tracker";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";

/** The last send before a submit may not hold the submit up for longer than this. */
const FINISH_WAIT_MS = 3_000;

const loadMediaPipe = async () => {
  const { createMediaPipeFaceSource } = await import("@/lib/integrity/mediapipe-face-source");
  return createMediaPipeFaceSource();
};

const isPermissionRefusal = (failure) =>
  failure instanceof DOMException && (failure.name === "NotAllowedError" || failure.name === "SecurityError");

/**
 * The integrity monitor of an ASSESSMENT interview. It is a hook, not a component, so the room can
 * hand it the current question and call `finish()` when the candidate submits.
 *
 * Three streams of observations meet here, and all of them become plain events (see lib/integrity):
 *  - the camera, looked at five times a second by a face detector running in this browser,
 *  - the page itself (tab hidden, window focus lost),
 *  - pastes into the answer box.
 * Events wait in an outbox and go to the server every ten seconds, and once more as the page closes.
 *
 * Any failure (no camera, permission refused, the model will not load) degrades to fewer checks and
 * a CAMERA_OFF event. It never stops the candidate from answering.
 *
 * Nothing here runs unless `enabled`, and every timer, listener and camera track is released when
 * the room closes, so the camera light goes out the moment the session ends.
 */
export function useIntegrityMonitor({ interviewId, enabled, questionId, createFaceSource = loadMediaPipe }) {
  const videoRef = useRef(null);
  const questionRef = useRef(questionId);
  const controls = useRef(null);
  const [camera, setCamera] = useState(enabled ? "starting" : "off");
  const [detecting, setDetecting] = useState(false);
  const [attention, setAttention] = useState(null);
  const [flagged, setFlagged] = useState(0);

  // Timers set up before the candidate moved to the next question must still see the new one.
  useEffect(() => {
    questionRef.current = questionId;
  }, [questionId]);

  useEffect(() => {
    if (!enabled) return;

    let alive = true;
    const tracker = new IntegrityTracker();
    const outbox = new EventOutbox(postBatchTo(interviewId));
    let stream = null;
    let source = null;
    let videoElement = null;
    let detectTimer;
    let lastAttention = null;
    let reportedCameraOff = false;
    // True from `finish()` until `resume()`: the candidate has submitted, and nothing seen after that is theirs to answer for.
    let paused = false;

    const note = (events) => {
      if (events.length === 0) return;
      outbox.add(events);
      if (alive) setFlagged((count) => count + events.length);
    };

    const noteCameraOff = () => {
      if (reportedCameraOff) return;
      reportedCameraOff = true;
      note(tracker.cameraOff(Date.now(), questionRef.current));
    };

    const releaseCamera = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      if (videoElement) videoElement.srcObject = null;
    };

    const onPageChange = () => {
      if (paused) return;
      note(
        tracker.page({
          nowMs: Date.now(),
          hidden: document.hidden,
          focused: document.hasFocus(),
          questionId: questionRef.current,
        }),
      );
    };

    const look = () => {
      const video = videoElement;
      // A hidden tab is already reported as TAB_HIDDEN, a video that has no picture yet cannot be read,
      // and once the candidate has submitted there is nothing left to look at.
      if (paused || !source || !video || document.hidden || video.readyState < 2 || video.videoWidth === 0) return;

      let faces;
      try {
        faces = toObservations(source.detect(video, performance.now()));
      } catch {
        return; // one bad frame is not worth a flag
      }
      note(tracker.frame({ nowMs: Date.now(), faces, questionId: questionRef.current }));

      const next =
        faces.length === 0
          ? "no-face"
          : faces.length > 1
            ? "multiple"
            : isLookingAway(faces[0]?.yaw ?? null)
              ? "away"
              : "ok";
      if (next !== lastAttention) {
        lastAttention = next;
        setAttention(next);
      }
    };

    const start = async () => {
      const devices = navigator.mediaDevices;
      if (!devices?.getUserMedia) {
        setCamera("unavailable");
        noteCameraOff();
        return;
      }

      try {
        stream = await devices.getUserMedia({
          video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
          audio: false,
        });
      } catch (failure) {
        if (!alive) return;
        setCamera(isPermissionRefusal(failure) ? "blocked" : "unavailable");
        noteCameraOff();
        return;
      }
      if (!alive) {
        releaseCamera();
        return;
      }

      videoElement = videoRef.current;
      if (!videoElement) {
        releaseCamera();
        setCamera("unavailable");
        noteCameraOff();
        return;
      }
      videoElement.srcObject = stream;
      void videoElement.play().catch(() => undefined);
      setCamera("on");

      // Unplugged, or permission taken back from the browser's address bar.
      stream.getVideoTracks()[0]?.addEventListener("ended", () => {
        if (!alive) return;
        window.clearInterval(detectTimer);
        setCamera("unavailable");
        setDetecting(false);
        setAttention(null);
        noteCameraOff();
      });

      try {
        source = await createFaceSource();
      } catch {
        if (!alive) return;
        // With no detector the camera would be on for nothing. Turn it off again and say so.
        releaseCamera();
        setCamera("unavailable");
        noteCameraOff();
        return;
      }
      if (!alive) {
        source.close();
        return;
      }
      setDetecting(true);
      detectTimer = window.setInterval(look, INTEGRITY_RULES.detectEveryMs);
    };

    const flushTimer = window.setInterval(() => void outbox.flush(), INTEGRITY_RULES.flushEveryMs);

    // As the page closes, close the open spans and hand everything to a `keepalive` request.
    const onPageHide = () => {
      outbox.add(tracker.flush(Date.now()));
      void outbox.flush();
    };

    // Started from a timer so that nothing in this effect updates state while it is still running.
    const startTimer = window.setTimeout(() => {
      onPageChange();
      void start();
    }, 0);

    document.addEventListener("visibilitychange", onPageChange);
    window.addEventListener("blur", onPageChange);
    window.addEventListener("focus", onPageChange);
    window.addEventListener("pagehide", onPageHide);

    controls.current = {
      paste: (chars) => {
        if (!paused) note(tracker.paste(Date.now(), chars, questionRef.current));
      },
      finish: async () => {
        note(tracker.flush(Date.now()));
        paused = true;
        await Promise.race([outbox.flush(), new Promise((resolve) => window.setTimeout(resolve, FINISH_WAIT_MS))]);
      },
      resume: () => {
        if (!paused) return;
        paused = false;
        onPageChange(); // look at the page as it is now, so a tab that was left hidden is not missed
      },
    };

    return () => {
      alive = false;
      controls.current = null;
      window.clearTimeout(startTimer);
      window.clearInterval(detectTimer);
      window.clearInterval(flushTimer);
      document.removeEventListener("visibilitychange", onPageChange);
      window.removeEventListener("blur", onPageChange);
      window.removeEventListener("focus", onPageChange);
      window.removeEventListener("pagehide", onPageHide);
      source?.close();
      releaseCamera();
      // Whatever is left goes out now: the room is closing, or monitoring was switched off.
      outbox.add(tracker.flush(Date.now()));
      void outbox.flush();
    };
  }, [enabled, interviewId, createFaceSource]);

  const recordPaste = useCallback((chars) => controls.current?.paste(chars), []);
  const finish = useCallback(async () => {
    await controls.current?.finish();
  }, []);
  const resume = useCallback(() => controls.current?.resume(), []);

  return { enabled, camera, detecting, attention, flagged, videoRef, recordPaste, finish, resume };
}
