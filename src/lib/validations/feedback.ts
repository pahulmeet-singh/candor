import { z } from "zod";
import { COMPETENCY_KEYS } from "@/lib/constants/competencies";
import { clampInt } from "@/lib/scoring";
import { categorySchema, clippedText } from "@/lib/validations/common";

/**
 * The shape of one evaluation report. The same schema is used three times:
 *  1. as the contract we describe to Gemini (see lib/ai/schemas.ts),
 *  2. to validate whatever any provider returns before we save it,
 *  3. to re-validate the JSONB column when we read it back.
 *
 * Model replies are treated as untrusted input, so the schema is lenient where
 * leniency is harmless (long text is trimmed, scores are rounded and clamped)
 * and strict where it matters (the five competencies, at least one question).
 */

const score10 = z.number().transform((n) => clampInt(n, 0, 10));

const listOf = (max: number, itemMax = 280) =>
  z
    .array(clippedText(itemMax))
    .min(1)
    .transform((items) => items.slice(0, max));

export const annotationSchema = z.object({
  kind: z.enum(["strength", "gap"]),
  /** A verbatim excerpt of the candidate's answer. */
  quote: clippedText(400),
  note: clippedText(400),
});

export const questionEvaluationSchema = z.object({
  questionId: z.string().min(1).max(32),
  score: score10,
  summary: clippedText(600),
  annotations: z.array(annotationSchema).transform((items) => items.slice(0, 6)),
  modelAnswer: clippedText(1600),
});

export const competencyScoreSchema = z.object({
  key: z.enum(COMPETENCY_KEYS),
  score: score10,
  note: clippedText(320),
});

export const evaluationSchema = z
  .object({
    summary: clippedText(1200),
    competencies: z.array(competencyScoreSchema).length(COMPETENCY_KEYS.length),
    questions: z.array(questionEvaluationSchema).min(1).max(10),
    topStrengths: listOf(5),
    topImprovements: listOf(5),
    nextSteps: listOf(5),
  })
  .refine((e) => new Set(e.competencies.map((c) => c.key)).size === COMPETENCY_KEYS.length, {
    message: "Each competency must appear exactly once",
    path: ["competencies"],
  });

export type Annotation = z.infer<typeof annotationSchema>;
export type QuestionEvaluation = z.infer<typeof questionEvaluationSchema>;
export type CompetencyScore = z.infer<typeof competencyScoreSchema>;
export type Evaluation = z.infer<typeof evaluationSchema>;

/** Query-string filters for /feedback. Bad values fall back to defaults instead of erroring. */
export const feedbackFilterSchema = z.object({
  category: categorySchema.optional().catch(undefined),
  range: z.enum(["all", "30d", "90d"]).catch("all"),
  sort: z.enum(["recent", "score_desc", "score_asc"]).catch("recent"),
  page: z.coerce.number().int().min(1).max(500).catch(1),
});

export type FeedbackFilters = z.infer<typeof feedbackFilterSchema>;
