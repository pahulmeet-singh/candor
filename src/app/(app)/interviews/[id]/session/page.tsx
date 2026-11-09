import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { InterviewRoom } from "@/components/interview/interview-room";
import { StartPanel } from "@/components/interview/start-panel";
import { requireUser } from "@/lib/auth/session";
import { getInterview } from "@/lib/data/interviews";
import { env } from "@/lib/env";
import { canStart } from "@/lib/status";

export const metadata: Metadata = { title: "Interview room" };

/**
 * One URL, three states. The server looks at where the interview is in its life
 * and renders the right thing: the start panel (not started), the live room
 * (in progress) or a redirect (finished or cancelled).
 */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const interview = await getInterview(user.id, id);
  if (!interview) notFound();

  if (interview.status === "COMPLETED") {
    redirect(interview.feedbackId ? `/feedback/${interview.feedbackId}` : `/interviews/${id}`);
  }
  if (interview.status === "CANCELLED") redirect(`/interviews/${id}`);

  if (interview.status === "IN_PROGRESS" && interview.transcript && interview.startedAt) {
    const { transcript } = interview;
    const initialAnswers = Object.fromEntries(
      Object.entries(transcript.answers).map(([questionId, answer]) => [questionId, answer.text]),
    );
    return (
      <InterviewRoom
        interviewId={interview.id}
        category={interview.category}
        difficulty={interview.difficulty}
        startedAt={interview.startedAt}
        durationMin={interview.durationMin}
        questions={transcript.questions}
        initialAnswers={initialAnswers}
      />
    );
  }

  // Not started yet (or, rarely, in progress with no questions): the details page explains if the room is closed.
  const decision = canStart(
    { status: interview.status, scheduledAt: new Date(interview.scheduledAt), durationMin: interview.durationMin },
    new Date(),
    env.demoMode,
  );
  if (!decision.ok) redirect(`/interviews/${id}`);

  return (
    <StartPanel
      interviewId={interview.id}
      category={interview.category}
      difficulty={interview.difficulty}
      usesResume={interview.usesResume}
    />
  );
}
