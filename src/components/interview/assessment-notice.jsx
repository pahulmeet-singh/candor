import { MONITORING_PROMISES } from "@/lib/integrity/copy";

/**
 * Tells the candidate what an assessment does, in the same words they agreed to on the booking form.
 * Shown on the interview's details page and again on the start panel, just before the camera is asked for.
 */
export function AssessmentNotice() {
  return (
    <section
      aria-labelledby="assessment-notice-title"
      className="grid gap-3 rounded-xl border border-line bg-raised/50 p-4 sm:p-5"
    >
      <h2 id="assessment-notice-title" className="font-serif text-lg font-semibold tracking-tight">
        This is an assessment
      </h2>
      <p className="text-sm text-muted">
        When the room opens, your browser will ask to use your camera. Please allow it. If you decline, you can still
        take the interview, and that is noted in your report.
      </p>
      <ul className="grid gap-2 text-sm text-muted">
        {MONITORING_PROMISES.map((promise) => (
          <li key={promise} className="flex gap-2.5">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
            <span>{promise}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
