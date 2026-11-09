import { test } from "node:test";
import assert from "node:assert/strict";
import { mockEvaluate, mockQuestions, MOCK_MODEL } from "@/lib/ai/mock";
import { reconcileEvaluation } from "@/lib/ai/reconcile";
import { isAppError } from "@/lib/errors";
import { overallScore } from "@/lib/scoring";
import type { Evaluation } from "@/lib/validations/feedback";
import type { Transcript } from "@/lib/validations/session";

const SAVED = "2026-10-30T05:00:00.000Z";
const GOOD_ANSWER =
  "A server action is an async function that runs on the server and can be passed to a form, so the form works without any client JavaScript.";

function transcript(answerFor: (index: number) => string): Transcript {
  const questions = mockQuestions("FULLSTACK_NEXT", "INTERMEDIATE", "reconcile");
  return {
    questions,
    answers: Object.fromEntries(questions.map((q, i) => [q.id, { text: answerFor(i), savedAt: SAVED }])),
    source: { provider: "mock", model: MOCK_MODEL, generatedAt: SAVED, usedResume: false },
  };
}

const ctx = { category: "FULLSTACK_NEXT", difficulty: "INTERMEDIATE" } as const;

test("a blank or near-blank answer is forced to zero even if the model gave it marks", () => {
  const t = transcript((i) => (i === 0 ? "" : i === 1 ? "ok sure" : GOOD_ANSWER));
  const generous: Evaluation = mockEvaluate(t, ctx);
  // Pretend a model rated every answer 9/10 and annotated the empty one.
  generous.questions = generous.questions.map((q) => ({
    ...q,
    score: 9,
    annotations: [{ kind: "strength", quote: "anything", note: "made up" }],
  }));

  const fixed = reconcileEvaluation(t, generous);
  assert.equal(fixed.questions[0].score, 0);
  assert.equal(fixed.questions[1].score, 0);
  assert.deepEqual(fixed.questions[0].annotations, []);
  assert.match(fixed.questions[0].summary, /No answer was written/);
  assert.match(fixed.questions[1].summary, /too short/);
  assert.equal(fixed.questions[2].score, 9);
});

test("the overall score comes from the per-question scores, not from anything the model says", () => {
  const t = transcript(() => GOOD_ANSWER);
  const evaluation = reconcileEvaluation(t, mockEvaluate(t, ctx));
  const expected = Math.round((evaluation.questions.reduce((sum, q) => sum + q.score, 0) / evaluation.questions.length) * 10);
  assert.equal(overallScore(evaluation.questions.map((q) => q.score)), expected);
});

test("questions come back in the order they were asked, and unknown ids are dropped", () => {
  const t = transcript(() => GOOD_ANSWER);
  const evaluation = mockEvaluate(t, ctx);
  const shuffled: Evaluation = {
    ...evaluation,
    questions: [
      { ...evaluation.questions[0], questionId: "q99" },
      ...[...evaluation.questions].reverse(),
    ],
  };
  const fixed = reconcileEvaluation(t, shuffled);
  assert.deepEqual(fixed.questions.map((q) => q.questionId), t.questions.map((q) => q.id));
});

test("a report that skips a question is rejected so the caller can ask again", () => {
  const t = transcript(() => GOOD_ANSWER);
  const evaluation = mockEvaluate(t, ctx);
  const incomplete: Evaluation = { ...evaluation, questions: evaluation.questions.slice(1) };
  assert.throws(
    () => reconcileEvaluation(t, incomplete),
    (error: unknown) => isAppError(error) && error.code === "AI_BAD_OUTPUT" && /q1/.test(error.message),
  );
});
