import Link from "next/link";
import { DifficultyBadge, ReadinessBadge } from "@/components/shared/interview-meta";
import { ScoreRing } from "@/components/shared/score-ring";
import { categoryLabel } from "@/lib/constants/categories";
import { formatDay, formatTime } from "@/lib/format";
import type { FeedbackListItemDTO } from "@/lib/types";

/** One row in the reports list. The whole row is the link, so the target is large. */
export function ReportCard({ report }: { report: FeedbackListItemDTO }) {
  return (
    <Link
      href={`/feedback/${report.id}`}
      className="group flex items-center gap-4 p-4 transition-colors hover:bg-raised sm:gap-5 sm:p-5"
    >
      <ScoreRing score={report.overallScore} size={64} stroke={6} />
      <span className="grid min-w-0 flex-1 gap-1.5">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-medium underline-offset-4 group-hover:text-primary group-hover:underline">
            {categoryLabel(report.category)}
          </span>
          <DifficultyBadge difficulty={report.difficulty} />
          <ReadinessBadge readiness={report.readiness} />
        </span>
        <span className="line-clamp-2 text-sm text-muted">{report.summary}</span>
      </span>
      <span className="hidden shrink-0 text-right text-sm leading-snug text-faint sm:block">
        {formatDay(report.completedAt)}
        <br />
        {formatTime(report.completedAt)}
      </span>
    </Link>
  );
}
