"use client";

import { CalendarPlus, History, CircleX } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useTransition } from "react";
import { toast } from "sonner";
import { cancelInterviewAction } from "@/actions/interviews";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { DifficultyBadge, StatusBadge } from "@/components/shared/interview-meta";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { categoryLabel } from "@/lib/constants/categories";
import { formatDayParts, formatTime } from "@/lib/format";
import type { InterviewDTO } from "@/lib/types";

export type InterviewTabKey = "upcoming" | "past" | "cancelled";

const EMPTY: Record<InterviewTabKey, { icon: typeof History; title: string; text: string }> = {
  upcoming: { icon: CalendarPlus, title: "Nothing booked", text: "Pick a half-hour slot between 10 am and 6 pm IST." },
  past: { icon: History, title: "No finished sessions yet", text: "Completed and missed sessions show up here." },
  cancelled: { icon: CircleX, title: "No cancelled bookings", text: "Bookings you cancel are listed here." },
};

function Row({ interview, onCancel }: { interview: InterviewDTO; onCancel: (id: string) => void }) {
  const day = formatDayParts(interview.scheduledAt);
  const status = interview.displayStatus;
  const label = categoryLabel(interview.category);

  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:flex-nowrap">
      <span className="flex w-14 shrink-0 flex-col items-center rounded-lg bg-raised py-1.5 leading-tight" aria-hidden="true">
        <span className="text-xs text-muted">{day.month}</span>
        <span className="font-serif text-xl font-semibold tabular-nums">{day.day}</span>
      </span>

      {/* basis-48 stops this block from collapsing to nothing on a phone, so the actions wrap onto their own line. */}
      <div className="grid min-w-0 flex-1 basis-48 gap-1">
        <Link href={`/interviews/${interview.id}`} className="truncate font-medium underline-offset-4 hover:text-primary hover:underline">
          {label}
        </Link>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
          <span>
            {day.weekday} {day.day} {day.month}, {formatTime(interview.scheduledAt)}
          </span>
          <DifficultyBadge difficulty={interview.difficulty} />
          {interview.usesResume ? <Badge tone="outline">Uses résumé</Badge> : null}
        </p>
      </div>

      {/* On a phone this is a second line (status on the left, buttons on the right); from `sm` up it sits beside the text. */}
      <div className="flex w-full items-center justify-between gap-2 sm:ml-auto sm:w-auto sm:shrink-0 sm:justify-end">
        <StatusBadge status={status} />

        <div className="flex items-center gap-2">
          {status === "IN_PROGRESS" ? (
            <Link href={`/interviews/${interview.id}/session`} className={buttonVariants({ size: "sm" })}>
              Continue
            </Link>
          ) : null}

          {status === "SCHEDULED" ? (
            <>
              <Link href={`/interviews/${interview.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Open
              </Link>
              <ConfirmDialog
                trigger={
                  <Button variant="ghost" size="sm" aria-label={`Cancel ${label} on ${day.weekday} ${day.day} ${day.month}`}>
                    Cancel
                  </Button>
                }
                title="Cancel this booking?"
                description={`${label}, ${day.weekday} ${day.day} ${day.month} at ${formatTime(interview.scheduledAt)}. The slot goes back to the pool.`}
                confirmLabel="Cancel booking"
                onConfirm={() => onCancel(interview.id)}
              />
            </>
          ) : null}

          {status === "COMPLETED" && interview.feedbackId ? (
            <Link href={`/feedback/${interview.feedbackId}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>
              Report{interview.overallScore !== null ? ` · ${interview.overallScore}` : ""}
            </Link>
          ) : null}

          {status === "MISSED" || status === "CANCELLED" ? (
            <Link
              href={`/interviews/new?category=${interview.category}`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              Book again
            </Link>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The list of bookings for one tab. Cancelling uses `useOptimistic`: the row
 * disappears the moment the user confirms, the Server Action runs in a
 * transition, and if it fails the row comes back and a toast says why.
 */
export function InterviewList({ interviews, tab }: { interviews: InterviewDTO[]; tab: InterviewTabKey }) {
  const [visible, removeOptimistically] = useOptimistic(interviews, (current, removedId: string) =>
    current.filter((item) => item.id !== removedId),
  );
  const [, startTransition] = useTransition();

  function cancel(id: string) {
    startTransition(async () => {
      removeOptimistically(id);
      const result = await cancelInterviewAction(id);
      if (result.ok) toast.success("Booking cancelled.");
      else toast.error(result.error);
    });
  }

  if (visible.length === 0) {
    const empty = EMPTY[tab];
    return (
      <Card>
        <EmptyState
          icon={empty.icon}
          title={empty.title}
          action={
            tab === "upcoming" ? (
              <Link href="/interviews/new" className={buttonVariants({ size: "sm" })}>
                Book an interview
              </Link>
            ) : undefined
          }
        >
          {empty.text}
        </EmptyState>
      </Card>
    );
  }

  return (
    <Card>
      <ul className="divide-y divide-line">
        {visible.map((interview) => (
          <Row key={interview.id} interview={interview} onCancel={cancel} />
        ))}
      </ul>
    </Card>
  );
}
