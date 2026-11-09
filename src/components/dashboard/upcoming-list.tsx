import Link from "next/link";
import { DifficultyBadge, StatusBadge } from "@/components/shared/interview-meta";
import { categoryLabel } from "@/lib/constants/categories";
import { formatDayParts, formatTime } from "@/lib/format";
import type { InterviewDTO } from "@/lib/types";

/** A compact list of the next few bookings: each row links to the interview page. */
export function UpcomingList({ interviews }: { interviews: InterviewDTO[] }) {
  return (
    <ul className="grid gap-1">
      {interviews.map((interview) => {
        const day = formatDayParts(interview.scheduledAt);
        return (
          <li key={interview.id}>
            <Link
              href={`/interviews/${interview.id}`}
              className="flex items-center gap-4 rounded-lg p-2.5 transition-colors hover:bg-raised"
            >
              <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-raised py-1.5 leading-tight">
                <span className="text-xs text-muted">{day.month}</span>
                <span className="font-serif text-xl font-semibold tabular-nums">{day.day}</span>
              </span>
              <span className="grid min-w-0 flex-1 gap-0.5">
                <span className="truncate font-medium">{categoryLabel(interview.category)}</span>
                <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                  <span className="whitespace-nowrap">
                    {day.weekday}, {formatTime(interview.scheduledAt)}
                  </span>
                  <DifficultyBadge difficulty={interview.difficulty} />
                </span>
              </span>
              <span className="shrink-0">
                <StatusBadge status={interview.displayStatus} />
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
