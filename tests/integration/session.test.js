import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { MOCK_MODEL } from "@/lib/ai/mock";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import { getInterview } from "@/lib/data/interviews";
import { prisma } from "@/lib/db";
import { bookInterview, cancelInterview } from "@/lib/services/booking";
import { saveAnswer, startInterview, submitInterview } from "@/lib/services/session";
import { EARLY_ENTRY_MINUTES } from "@/lib/status";
import { NOW, bookingInput, createUser, freshSlot, rejectsWith, resetDatabase } from "./helpers";

const MINUTE = 60_000;

/** A new user with one booking, and the instant their slot starts. */
async function bookFor(label) {
  const user = await createUser(label);
  const startsAt = freshSlot();
  const interview = await bookInterview(user.id, bookingInput(startsAt), NOW);
  return { user, interview, startsAt };
}

function transcriptOf(detail) {
  assert.ok(detail?.transcript, "the interview should have a transcript");
  return detail.transcript;
}

describe("the interview lifecycle on a real PostgreSQL database", () => {
  before(resetDatabase);
  after(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("runs a whole session: start, autosave, submit, report", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt } = await bookFor("whole");

    // The room opens ten minutes before the slot, not earlier.
    const tooEarly = new Date(startsAt.getTime() - (EARLY_ENTRY_MINUTES + 1) * MINUTE);
    await rejectsWith(startInterview(user.id, interview.id, tooEarly), "INVALID_STATE");
    assert.equal((await getInterview(user.id, interview.id, NOW))?.status, "SCHEDULED");

    const started = await startInterview(user.id, interview.id, startsAt);
    assert.equal(started.status, "IN_PROGRESS");
    const transcript = transcriptOf(started);
    assert.equal(transcript.questions.length, QUESTIONS_PER_SESSION);
    assert.equal(transcript.source.provider, "mock");
    const [first, second] = transcript.questions;
    assert.ok(first && second);

    // Reloading the room must not write a second set of questions.
    const reopened = await startInterview(user.id, interview.id, new Date(startsAt.getTime() + MINUTE));
    assert.deepEqual(transcriptOf(reopened).questions, transcript.questions);

    // Two autosaves that overlap both survive. This is what the single jsonb_set statement is for.
    await Promise.all([
      saveAnswer(user.id, { interviewId: interview.id, questionId: first.id, text: "My first answer." }, startsAt),
      saveAnswer(user.id, { interviewId: interview.id, questionId: second.id, text: "My second answer." }, startsAt),
    ]);
    let stored = transcriptOf(await getInterview(user.id, interview.id, startsAt));
    assert.equal(stored.answers[first.id]?.text, "My first answer.");
    assert.equal(stored.answers[second.id]?.text, "My second answer.");

    // Saving a question again replaces its text and leaves the other answer alone.
    await saveAnswer(
      user.id,
      { interviewId: interview.id, questionId: first.id, text: "A better first answer." },
      startsAt,
    );
    stored = transcriptOf(await getInterview(user.id, interview.id, startsAt));
    assert.equal(stored.answers[first.id]?.text, "A better first answer.");
    assert.equal(stored.answers[second.id]?.text, "My second answer.");

    // Submitting grades the answers on screen, which may be newer than the last autosave.
    const lastWords = "I would clarify the goal, compare two options, test the change and watch it after release.";
    const submittedAt = new Date(startsAt.getTime() + 20 * MINUTE);
    const result = await submitInterview(user.id, interview.id, { [second.id]: lastWords }, submittedAt);
    assert.equal(result.alreadySubmitted, false);
    assert.ok(result.overallScore >= 0 && result.overallScore <= 100);

    const row = await prisma.interview.findUniqueOrThrow({ where: { id: interview.id }, include: { feedback: true } });
    assert.equal(row.status, "COMPLETED");
    assert.equal(row.completedAt?.toISOString(), submittedAt.toISOString());
    assert.equal(row.feedback?.id, result.feedbackId);
    assert.equal(row.feedback?.overallScore, result.overallScore);
    assert.equal(row.feedback?.model, MOCK_MODEL);
    assert.equal(
      transcriptOf(await getInterview(user.id, interview.id, submittedAt)).answers[second.id]?.text,
      lastWords,
    );

    // Submitting again returns the same report instead of grading twice.
    const repeat = await submitInterview(user.id, interview.id, undefined, submittedAt);
    assert.equal(repeat.feedbackId, result.feedbackId);
    assert.equal(repeat.alreadySubmitted, true);

    // A finished interview is frozen.
    await rejectsWith(
      saveAnswer(user.id, { interviewId: interview.id, questionId: first.id, text: "Too late now." }, submittedAt),
      "INVALID_STATE",
    );
    await rejectsWith(startInterview(user.id, interview.id, startsAt), "INVALID_STATE");
    await rejectsWith(cancelInterview(user.id, interview.id, submittedAt), "INVALID_STATE");
  });

  it("starting from two tabs at once writes one set of questions", async () => {
    const { user, interview, startsAt } = await bookFor("two-tabs");

    const [one, two] = await Promise.all([
      startInterview(user.id, interview.id, startsAt),
      startInterview(user.id, interview.id, startsAt),
    ]);

    assert.equal(one.status, "IN_PROGRESS");
    assert.equal(two.status, "IN_PROGRESS");
    assert.deepEqual(transcriptOf(one), transcriptOf(two));
  });

  it("submitting from three tabs at once creates exactly one report", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt } = await bookFor("three-submits");
    const started = await startInterview(user.id, interview.id, startsAt);
    const [question] = transcriptOf(started).questions;
    assert.ok(question);

    const answers = {
      [question.id]: "I would clarify the goal, compare two options and say how I would verify the result.",
    };
    const later = new Date(startsAt.getTime() + 15 * MINUTE);
    const results = await Promise.all([1, 2, 3].map(() => submitInterview(user.id, interview.id, answers, later)));

    assert.equal(results.filter((result) => !result.alreadySubmitted).length, 1, "only one call does the grading");
    assert.equal(new Set(results.map((result) => result.feedbackId)).size, 1, "all three get the same report");
    assert.equal(await prisma.feedback.count({ where: { interviewId: interview.id } }), 1);
  });

  it("keeps one person's interview out of another person's reach", async () => {
    const { user, interview, startsAt } = await bookFor("owner");
    const stranger = await createUser("stranger");

    await rejectsWith(startInterview(stranger.id, interview.id, startsAt), "NOT_FOUND");
    await rejectsWith(
      saveAnswer(stranger.id, { interviewId: interview.id, questionId: "q1", text: "hello there" }, startsAt),
      "NOT_FOUND",
    );
    await rejectsWith(submitInterview(stranger.id, interview.id, undefined, startsAt), "NOT_FOUND");
    await rejectsWith(cancelInterview(stranger.id, interview.id, NOW), "NOT_FOUND");
    assert.equal(await getInterview(stranger.id, interview.id, startsAt), null);

    // Nothing changed for the owner.
    assert.equal((await getInterview(user.id, interview.id, startsAt))?.status, "SCHEDULED");
  });

  it("enforces the state rules around starting, answering and submitting", async () => {
    // A booking that has not started takes no answers and cannot be submitted.
    const idle = await bookFor("rules-idle");
    await rejectsWith(
      saveAnswer(idle.user.id, { interviewId: idle.interview.id, questionId: "q1", text: "too early" }, idle.startsAt),
      "INVALID_STATE",
    );
    await rejectsWith(submitInterview(idle.user.id, idle.interview.id, undefined, idle.startsAt), "INVALID_STATE");

    // A slot that ended more than the session length ago can no longer be started.
    const missed = new Date(idle.startsAt.getTime() + 31 * MINUTE);
    await rejectsWith(startInterview(idle.user.id, idle.interview.id, missed), "INVALID_STATE");

    // A cancelled booking cannot be started.
    const cancelled = await bookFor("rules-cancelled");
    await cancelInterview(cancelled.user.id, cancelled.interview.id, NOW);
    await rejectsWith(startInterview(cancelled.user.id, cancelled.interview.id, cancelled.startsAt), "INVALID_STATE");

    // An answer for a question that is not in the session is refused.
    const live = await bookFor("rules-live");
    await startInterview(live.user.id, live.interview.id, live.startsAt);
    await rejectsWith(
      saveAnswer(
        live.user.id,
        { interviewId: live.interview.id, questionId: "not-a-question", text: "hello there" },
        live.startsAt,
      ),
      "VALIDATION",
    );
  });
});
