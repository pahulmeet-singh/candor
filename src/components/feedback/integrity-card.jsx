import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { formatClock, formatDuration } from "@/lib/format";
import { REVIEW_AT_POINTS } from "@/lib/integrity/summary";
import { INTEGRITY_DISCLAIMER } from "@/lib/integrity/constants";

const LEVEL = {
  CLEAR: { label: "Nothing noted", tone: "success" },
  NOTED: { label: "A few noted", tone: "info" },
  REVIEW: { label: "Worth a look", tone: "danger" },
};

/**
 * What the integrity monitor noticed during an assessment. A Server Component with no state, like
 * the rest of the report, so it prints and renders in the modal the same way.
 *
 * The wording matters as much as the numbers: this is a list of signals for a person to review,
 * and it says so at the top and at the bottom. It also says it never touches the score, which is true:
 * nothing in the evaluation reads these events.
 */
export function IntegrityCard({ summary }) {
  const level = LEVEL[summary.level];

  return (
    <Card className="grid gap-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={level.tone}>{level.label}</Badge>
        <p className="font-medium">{summary.headline}</p>
      </div>

      <p className="text-sm text-muted">{INTEGRITY_DISCLAIMER}</p>

      {summary.byType.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label="Totals by kind">
          {summary.byType.map((row) => (
            <li key={row.type}>
              <Badge tone="outline">
                {row.label} &times; {row.count}
                {row.totalMs > 0 ? ` · ${formatDuration(row.totalMs)}` : ""}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}

      {summary.timeline.length > 0 ? (
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <ol className="grid divide-y divide-line rounded-lg border border-line text-sm">
            {summary.timeline.map((entry) => {
              const details = [
                entry.questionNumber ? `Question ${entry.questionNumber}` : null,
                entry.durationMs > 0 ? formatDuration(entry.durationMs) : null,
                entry.note,
              ].filter((part) => part !== null);
              return (
                <li key={entry.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-0.5 px-4 py-2.5">
                  <span className="w-12 shrink-0 text-faint tabular-nums" title="Time since the interview started">
                    {formatClock(entry.offsetMs)}
                  </span>
                  <span className="font-medium">{entry.label}</span>
                  {details.length > 0 ? <span className="text-muted">{details.join(" · ")}</span> : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}

      <p className="text-xs text-faint">
        Attention score {summary.points}. A person is asked to look at the timeline from {REVIEW_AT_POINTS}. This
        section never changes your score.
      </p>
    </Card>
  );
}
