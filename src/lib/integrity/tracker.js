import { isLookingAway } from "./head-pose";
import { INTEGRITY_RULES } from "./constants";

/**
 * Turns raw observations into events. Pure logic with no camera, no DOM and no clock of its own:
 * the browser feeds it observations with timestamps, which makes every rule testable with
 * invented frames.
 */

/**
 * Watches one yes/no condition over time and reports it as a span once it has lasted long enough.
 *
 * Two kinds of source feed it. Camera frames are SAMPLED: they arrive every 200 ms, a detector can
 * flicker for a frame or two, so a gap shorter than `graceMs` does not end the span, and a span
 * ends at the last sample that still saw the condition. Page events are EDGES: the browser says
 * "hidden" once and "visible" once, nothing in between, so the span runs from one event to the other.
 */
export class SpanTracker {
  startMs = null;
  lastActiveMs = 0;
  questionId = null;

  constructor(minMs, graceMs, edgeTriggered = false) {
    this.minMs = minMs;
    this.graceMs = graceMs;
    this.edgeTriggered = edgeTriggered;
  }

  /**
   * Feed one observation. Returns a finished span when the condition has ended and lasted long enough.
   *
   * A sampled span that goes quiet for longer than the grace period is closed at its last sighting,
   * whether the quiet was "no" samples or no samples at all (a throttled background tab stops
   * sampling). A gap in sampling is not evidence that the condition carried on, so it is never bridged.
   */
  update(active, nowMs, questionId = null) {
    const lapsed = this.startMs !== null && !this.edgeTriggered && nowMs - this.lastActiveMs > this.graceMs;

    if (active) {
      const finished = lapsed ? this.finish(this.lastActiveMs) : null;
      if (this.startMs === null) {
        this.startMs = nowMs;
        this.questionId = questionId;
      }
      this.lastActiveMs = nowMs;
      return finished;
    }
    if (this.startMs === null) return null;
    if (this.edgeTriggered) return this.finish(nowMs);
    return lapsed ? this.finish(this.lastActiveMs) : null;
  }

  /** Closes an open span, for when the session ends or the page is closing. */
  flush(nowMs) {
    if (this.startMs === null) return null;
    return this.finish(this.edgeTriggered ? nowMs : this.lastActiveMs);
  }

  finish(endMs) {
    const startedAtMs = this.startMs;
    const questionId = this.questionId;
    this.startMs = null;
    this.questionId = null;
    if (startedAtMs === null) return null;
    const durationMs = Math.max(0, endMs - startedAtMs);
    return durationMs >= this.minMs ? { startedAtMs, durationMs, questionId } : null;
  }
}

export class IntegrityTracker {
  spans;

  constructor(rules = INTEGRITY_RULES) {
    this.rules = rules;

    this.spans = {
      FACE_MISSING: new SpanTracker(rules.faceMissingMs, rules.graceMs),
      MULTIPLE_FACES: new SpanTracker(rules.multipleFacesMs, rules.graceMs),
      LOOKING_AWAY: new SpanTracker(rules.lookingAwayMs, rules.graceMs),
      TAB_HIDDEN: new SpanTracker(rules.tabHiddenMs, 0, true),
      FOCUS_LOST: new SpanTracker(rules.focusLostMs, 0, true),
    };
  }

  /** One look at the camera picture. */
  frame({ nowMs, faces, questionId }) {
    const single = faces.length === 1 ? faces[0] : undefined;
    return this.collect(
      [
        ["FACE_MISSING", faces.length === 0],
        ["MULTIPLE_FACES", faces.length >= 2],
        ["LOOKING_AWAY", single !== undefined && isLookingAway(single.yaw, this.rules.lookingAwayYaw)],
      ],
      nowMs,
      questionId,
    );
  }

  /** The page changed: the tab was hidden or shown, or the window gained or lost focus. */
  page({ nowMs, hidden, focused, questionId }) {
    // A hidden tab also loses focus. Count it once, as the more specific "left the tab".
    return this.collect(
      [
        ["TAB_HIDDEN", hidden],
        ["FOCUS_LOST", !hidden && !focused],
      ],
      nowMs,
      questionId,
    );
  }

  /** Text was pasted into an answer. Short pastes are ordinary editing and are ignored. */
  paste(nowMs, chars, questionId) {
    if (chars < this.rules.pasteMinChars) return [];
    return [{ type: "PASTE", startedAtMs: Math.round(nowMs), durationMs: 0, questionId, detail: { chars } }];
  }

  /** The camera could not be used (blocked, unplugged or the model failed to load). */
  cameraOff(nowMs, questionId) {
    return [{ type: "CAMERA_OFF", startedAtMs: Math.round(nowMs), durationMs: 0, questionId }];
  }

  /** Closes every open span. Call it when the session ends or the page is closing. */
  flush(nowMs) {
    const drafts = [];
    for (const type of Object.keys(this.spans)) {
      const span = this.spans[type].flush(nowMs);
      if (span) drafts.push(toDraft(type, span));
    }
    return drafts;
  }

  collect(observations, nowMs, questionId) {
    const drafts = [];
    for (const [type, active] of observations) {
      const span = this.spans[type].update(active, nowMs, questionId);
      if (span) drafts.push(toDraft(type, span));
    }
    return drafts;
  }
}

function toDraft(type, span) {
  return {
    type,
    startedAtMs: Math.round(span.startedAtMs),
    durationMs: Math.round(span.durationMs),
    questionId: span.questionId,
  };
}
