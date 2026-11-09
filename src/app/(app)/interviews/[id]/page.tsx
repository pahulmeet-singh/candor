import { Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { CancelBooking } from "@/components/interview/cancel-booking";
import { DifficultyBadge, StatusBadge } from "@/components/shared/interview-meta";
import { PageHeader } from "@/components/shared/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { categoryLabel } from "@/lib/constants/categories";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import { getInterview } from "@/lib/data/interviews";
import { env } from "@/lib/env";
import { formatDateTime, formatDay, formatLongDate, formatTime, formatTimeRange } from "@/lib/format";
import { canStart, canCancel } from "@/lib/status";

export const metadata: Metadata = { title: "Interview" };

const STEPS = [
  {
    title: "Open the room",
    text: `The room is open from ten minutes before your slot until it ends. The moment you start, ${QUESTIONS_PER_SESSION} questions are written for you.`,
  },
  {
    title: "Answer in your own words",
    text: "Type as you would speak. Your answers save as you go, and you can move back and forth between questions.",
  },
  {
    title: "Submit for feedback",
    text: "You get a score out of 100, five competency scores, and your own sentences highlighted where they worked and where they did not.",
  },
];

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}

function SessionGuide() {
  return (
    <Card className="p-6">
      <h2 className="font-serif text-xl font-semibold tracking-tight">How the session works</h2>
      <ol className="mt-5 grid gap-5">
        {STEPS.map((step, index) => (
          <li key={step.title} className="flex gap-4">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full bg-raised font-serif font-semibold text-primary"
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <div>
              <h3 className="font-medium">{step.title}</h3>
              <p className="mt-0.5 text-sm text-muted">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

/** Server-rendered detail page for one booking. The primary action depends on where the session is in its life. */
export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const interview = await getInterview(user.id, id);
  if (!interview) notFound();

  const now = new Date();
  const scheduledAt = new Date(interview.scheduledAt);
  const decision = canStart(
    { status: interview.status, scheduledAt, durationMin: interview.durationMin },
    now,
    env.demoMode,
  );
  const status = interview.displayStatus;
  const slotEnd = new Date(scheduledAt.getTime() + interview.durationMin * 60_000);
  const sessionHref = `/interviews/${interview.id}/session`;
  // The explainer is for a session that still lies ahead; once it is finished or cancelled it is just noise.
  const showGuide = status === "SCHEDULED" || status === "IN_PROGRESS";

  let primary: ReactNode;
  if (status === "IN_PROGRESS") {
    primary = (
      <Link href={sessionHref} className={buttonVariants()}>
        Continue session
      </Link>
    );
  } else if (status === "SCHEDULED") {
    primary = decision.ok ? (
      <Link href={sessionHref} className={buttonVariants()}>
        Open interview room
      </Link>
    ) : (
      <Button disabled>Open interview room</Button>
    );
  } else if (status === "COMPLETED" && interview.feedbackId) {
    primary = (
      <Link href={`/feedback/${interview.feedbackId}`} className={buttonVariants()}>
        View report
      </Link>
    );
  } else {
    primary = (
      <Link href={`/interviews/new?category=${interview.category}`} className={buttonVariants()}>
        Book again
      </Link>
    );
  }

  return (
    <>
      <PageHeader
        title={`${categoryLabel(interview.category)} interview`}
        description={`${formatDay(scheduledAt)} at ${formatTimeRange(scheduledAt, slotEnd)} IST`}
        actions={
          <>
            {primary}
            {canCancel(interview.status) ? <CancelBooking interviewId={interview.id} /> : null}
          </>
        }
      />

      <div className={showGuide ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start" : "grid max-w-xl gap-5"}>
        <div className="grid gap-5 empty:hidden">
          {status === "SCHEDULED" && !decision.ok && decision.reason === "TOO_EARLY" ? (
            <Alert tone="info" title="The room is not open yet">
              It opens on {formatDateTime(decision.opensAt)} IST, ten minutes before your slot.
            </Alert>
          ) : null}
          {status === "MISSED" ? (
            <Alert tone="danger" title="This slot has passed">
              The session was not started in time. Book a new one whenever you are ready.
            </Alert>
          ) : null}
          {env.demoMode && status === "SCHEDULED" ? (
            <Alert tone="warning" title="Demo mode is on">
              Normally the room only opens near the slot time. In demo mode you can start any time.
            </Alert>
          ) : null}

          {showGuide ? <SessionGuide /> : null}
        </div>

        <Card className="p-5">
          <h2 className="font-serif text-lg font-semibold">Details</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            <Detail label="Status">
              <StatusBadge status={status} />
            </Detail>
            <Detail label="Level">
              <DifficultyBadge difficulty={interview.difficulty} />
            </Detail>
            <Detail label="Date">{formatLongDate(scheduledAt)}</Detail>
            <Detail label="Slot">{formatTimeRange(scheduledAt, slotEnd)}</Detail>
            <Detail label="Questions">{QUESTIONS_PER_SESSION}, typed</Detail>
            <Detail label="Résumé">{interview.usesResume ? "Used" : "Not used"}</Detail>
            {interview.startedAt ? <Detail label="Started">{formatTime(interview.startedAt)}</Detail> : null}
            {interview.completedAt ? (
              <Detail label="Finished">
                <span className="inline-flex items-center gap-1.5">
                  <Check className="size-4 text-sage" aria-hidden="true" />
                  {formatTime(interview.completedAt)}
                </span>
              </Detail>
            ) : null}
            {interview.overallScore !== null ? <Detail label="Score">{interview.overallScore} / 100</Detail> : null}
          </dl>
        </Card>
      </div>
    </>
  );
}
