/**
 * Pure helpers for the interview transcript (the JSONB column on `Interview`).
 * No I/O, so the merge rules are covered by unit tests.
 */

import { ANSWER_MIN_WORDS } from "@/lib/constants/limits";
import { countWords } from "@/lib/scoring";
import type { Transcript } from "@/lib/validations/session";

/**
 * Applies the answers the browser had on screen at the moment of "Submit".
 * Autosave runs on a delay, so the last few keystrokes may not be stored yet;
 * sending them with the submit request means nothing the candidate wrote is lost.
 * Unknown question ids are ignored, and an answer that has not changed keeps its
 * original `savedAt`.
 */
export function mergeAnswers(
  transcript: Transcript,
  incoming: Record<string, string> | undefined,
  now: Date,
): Transcript {
  if (!incoming) return transcript;
  const known = new Set(transcript.questions.map((question) => question.id));
  const answers = { ...transcript.answers };
  for (const [questionId, text] of Object.entries(incoming)) {
    if (!known.has(questionId)) continue;
    if (answers[questionId]?.text === text) continue;
    answers[questionId] = { text, savedAt: now.toISOString() };
  }
  return { ...transcript, answers };
}

/** How many questions have an answer long enough to be assessed. */
export function countAnswered(transcript: Pick<Transcript, "questions" | "answers">): number {
  return transcript.questions.filter(
    (question) => countWords(transcript.answers[question.id]?.text ?? "") >= ANSWER_MIN_WORDS,
  ).length;
}
