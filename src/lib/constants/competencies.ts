/**
 * The five competencies every answer is judged on. They are fixed so that
 * reports are comparable across sessions and the radar chart always has the
 * same five axes.
 */
export const COMPETENCY_KEYS = [
  "technical_accuracy",
  "depth",
  "problem_solving",
  "communication",
  "structure",
] as const;

export type CompetencyKey = (typeof COMPETENCY_KEYS)[number];

export const COMPETENCY_META: Record<CompetencyKey, { label: string; short: string; hint: string }> = {
  technical_accuracy: {
    label: "Technical accuracy",
    short: "Accuracy",
    hint: "Are the facts and mechanisms you state correct?",
  },
  depth: {
    label: "Depth",
    short: "Depth",
    hint: "Do you go past the definition into how it works and why?",
  },
  problem_solving: {
    label: "Problem solving",
    short: "Problem solving",
    hint: "Do you reason from the problem to a solution and weigh the trade-offs?",
  },
  communication: {
    label: "Communication",
    short: "Clarity",
    hint: "Is the answer clear, concise and easy to follow out loud?",
  },
  structure: {
    label: "Structure",
    short: "Structure",
    hint: "Is there an order to it: claim, reasoning, example, wrap-up?",
  },
};

export function competencyLabel(key: CompetencyKey): string {
  return COMPETENCY_META[key].label;
}
