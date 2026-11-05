/**
 * Scoring rules. The model only ever scores individual answers (0-10).
 * Everything derived from those numbers is computed here, on the server, so a
 * model that gets arithmetic wrong cannot change a user's overall score.
 */

export type Readiness = "NEEDS_WORK" | "ON_TRACK" | "INTERVIEW_READY";

export const READINESS_META: Record<Readiness, { label: string; blurb: string }> = {
  NEEDS_WORK: {
    label: "Needs work",
    blurb: "There are core gaps to close before a real interview.",
  },
  ON_TRACK: {
    label: "On track",
    blurb: "A solid base. Tighten the depth and the structure of your answers.",
  },
  INTERVIEW_READY: {
    label: "Interview ready",
    blurb: "Clear, well-structured answers. Keep practising under time pressure.",
  },
};

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}

export function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Mean of the per-question scores (each 0-10) scaled to 0-100 and rounded. */
export function overallScore(questionScores: readonly number[]): number {
  if (questionScores.length === 0) return 0;
  return clampInt(average(questionScores) * 10, 0, 100);
}

export function readinessOf(score: number): Readiness {
  if (score < 50) return "NEEDS_WORK";
  if (score < 75) return "ON_TRACK";
  return "INTERVIEW_READY";
}

export type ScoreTone = "low" | "mid" | "high";

/** Colour band for a 0-100 score; the UI maps tones to theme colours. */
export function scoreTone(score: number): ScoreTone {
  if (score < 50) return "low";
  if (score < 75) return "mid";
  return "high";
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? 0 : trimmed.split(/\s+/).length;
}
