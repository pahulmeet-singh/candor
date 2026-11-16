import { Camera, CameraOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { pluralize } from "@/lib/format";
import { cn } from "@/lib/utils";

const LISTENING = {
  ok: { text: "One face in view, facing the screen.", tone: "text-sage" },
  "no-face": { text: "No face in view. Move back into the frame.", tone: "text-coral" },
  multiple: { text: "More than one face in view.", tone: "text-coral" },
  away: { text: "Head turned away. Face the screen.", tone: "text-coral" },
};

function statusOf(monitor) {
  switch (monitor.camera) {
    case "starting":
      return { text: "Starting the camera. Allow it when your browser asks.", tone: "text-muted" };
    case "blocked":
      return {
        text: "The camera is blocked, so only focus checks run, and this is noted in your report. To turn it on, allow the camera for this site in your browser and reload. Your answers are saved.",
        tone: "text-coral",
      };
    case "unavailable":
      return {
        text: "No camera could be used, so only focus checks run. This is noted in your report.",
        tone: "text-coral",
      };
    case "on":
      if (!monitor.detecting) return { text: "Loading the face checks.", tone: "text-muted" };
      return monitor.attention ? LISTENING[monitor.attention] : { text: "Looking for your face.", tone: "text-muted" };
    default:
      return { text: "", tone: "text-muted" };
  }
}

/**
 * What the candidate sees while an assessment is running: their own camera picture (mirrored, as in
 * a video call), what the checks see right now, and how many flags there are so far. Showing it all
 * is deliberate. Being watched without being told what is being looked at is the part of
 * proctoring that people object to.
 */
export function IntegrityPanel({ monitor }) {
  if (!monitor.enabled) return null;

  const status = statusOf(monitor);
  const live = monitor.camera === "on" || monitor.camera === "starting";

  return (
    <Card className="flex flex-wrap items-center gap-4 px-4 py-3" aria-label="Assessment monitoring">
      <div className="relative h-[4.5rem] w-24 shrink-0 overflow-hidden rounded-lg bg-raised">
        {/* Always rendered, so the monitor has an element to attach the stream to. */}
        <video
          ref={monitor.videoRef}
          muted
          playsInline
          autoPlay
          aria-hidden="true"
          className={cn("size-full object-cover [transform:scaleX(-1)]", !live && "invisible")}
        />
        {!live ? (
          <span className="absolute inset-0 grid place-items-center text-muted">
            <CameraOff className="size-6" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="grid min-w-0 flex-1 gap-0.5">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Camera className="size-4 text-primary" aria-hidden="true" />
          Assessment mode
        </p>
        <p role="status" className={cn("text-sm", status.tone)}>
          {status.text}
        </p>
        <p className="text-xs text-faint">
          Your video stays in this browser. Only the kind, time and length of each event is saved.
        </p>
      </div>

      <p className="text-sm text-muted tabular-nums" title="Shown in your report as signals for review, not proof.">
        {pluralize(monitor.flagged, "flag")} so far
      </p>
    </Card>
  );
}
