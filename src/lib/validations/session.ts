import { z } from "zod";
import { ANSWER_MAX_CHARS, QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import { idSchema } from "@/lib/validations/common";

export const transcriptQuestionSchema = z.object({
  id: z.string().min(1).max(32),
  text: z.string().min(10).max(700),
  topic: z.string().min(1).max(80),
  /** Present when the question came from the built-in bank (used by the offline evaluator). */
  seedId: z.string().max(64).optional(),
});

export const transcriptAnswerSchema = z.object({
  text: z.string().max(ANSWER_MAX_CHARS),
  savedAt: z.iso.datetime({ offset: true }),
});

/** What we keep in `Interview.transcript` (JSONB). */
export const transcriptSchema = z.object({
  questions: z.array(transcriptQuestionSchema).min(1).max(10),
  answers: z.record(z.string(), transcriptAnswerSchema),
  source: z.object({
    provider: z.enum(["gemini", "mock"]),
    model: z.string().max(80),
    generatedAt: z.iso.datetime({ offset: true }),
    usedResume: z.boolean(),
  }),
});

export type TranscriptQuestion = z.infer<typeof transcriptQuestionSchema>;
export type TranscriptAnswer = z.infer<typeof transcriptAnswerSchema>;
export type Transcript = z.infer<typeof transcriptSchema>;

/** What the question generator must return, whichever provider produced it. */
export const generatedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(15, "Question too short").max(500),
        topic: z.string().trim().min(2).max(60),
      }),
    )
    .length(QUESTIONS_PER_SESSION),
});

export type GeneratedQuestions = z.infer<typeof generatedQuestionsSchema>;

/** Autosave payload from the interview room. */
export const saveAnswerSchema = z.object({
  interviewId: idSchema,
  questionId: z.string().min(1).max(32),
  text: z.string().max(ANSWER_MAX_CHARS, `Answers can be up to ${ANSWER_MAX_CHARS} characters`),
});

export type SaveAnswerInput = z.infer<typeof saveAnswerSchema>;

/**
 * Body of "submit for evaluation". The browser sends the answers it has on
 * screen, so the last keystrokes are not lost if autosave has not fired yet.
 */
export const submitSchema = z.object({
  answers: z.record(z.string().min(1).max(32), z.string().max(ANSWER_MAX_CHARS)).optional(),
});

export type SubmitInput = z.infer<typeof submitSchema>;
