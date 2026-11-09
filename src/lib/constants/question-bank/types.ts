import type { Difficulty } from "@/lib/constants/difficulty";

/**
 * One thing a good answer should cover. The offline evaluator checks whether
 * the candidate's answer contains at least `min` (default 1) of the `anyOf`
 * phrases, matched case-insensitively. Real model evaluation does not use this;
 * it is the rubric for AI_MODE=mock and the style guide we show the model.
 */
export interface RubricPoint {
  label: string;
  /** Lower-case words or phrases. */
  anyOf: readonly string[];
  /** How many distinct phrases from `anyOf` are needed to count as covered. */
  min?: number;
}

export interface BankQuestion {
  /** Stable id such as "fe-04". Stored on transcript questions as `seedId`. */
  id: string;
  difficulty: Difficulty;
  topic: string;
  text: string;
  rubric: readonly RubricPoint[];
  /** What a strong answer sounds like, shown in the report. */
  modelAnswer: string;
}
