/**
 * Makes a model's evaluation safe to store, whichever provider produced it.
 * Pure on purpose, so it can be unit-tested without any network.
 */

import { ANSWER_MIN_WORDS } from "@/lib/constants/limits";
import { AppError } from "@/lib/errors";
import { countWords } from "@/lib/scoring";
import type { Evaluation } from "@/lib/validations/feedback";
import type { Transcript } from "@/lib/validations/session";

/**
 * - Every question that was asked must have exactly one entry, in the order asked.
 *   Unknown ids are dropped; a missing one means the model skipped work, so we ask again.
 * - A blank or near-blank answer scores 0 no matter what the model said.
 */
export function reconcileEvaluation(transcript: Transcript, evaluation: Evaluation): Evaluation {
  const byId = new Map(evaluation.questions.map((entry) => [entry.questionId, entry] as const));

  const questions = transcript.questions.map((question) => {
    const entry = byId.get(question.id);
    if (!entry) {
      throw new AppError("AI_BAD_OUTPUT", `The AI report skipped question ${question.id}.`);
    }
    const words = countWords(transcript.answers[question.id]?.text ?? "");
    if (words < ANSWER_MIN_WORDS) {
      return {
        ...entry,
        score: 0,
        summary: words === 0 ? "No answer was written for this question." : "The answer was too short to assess.",
        annotations: [],
      };
    }
    return entry;
  });

  return { ...evaluation, questions };
}
