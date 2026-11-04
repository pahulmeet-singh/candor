export const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIFFICULTY_META: Record<
  Difficulty,
  { label: string; blurb: string; rank: number }
> = {
  BEGINNER: {
    label: "Beginner",
    blurb: "Core concepts and definitions. A good first mock or a warm-up before a real round.",
    rank: 1,
  },
  INTERMEDIATE: {
    label: "Intermediate",
    blurb: "Trade-offs and applied scenarios, like a typical campus or junior-role interview.",
    rank: 2,
  },
  ADVANCED: {
    label: "Advanced",
    blurb: "Depth, edge cases and design judgement. Expect follow-up style questions.",
    rank: 3,
  },
};

export function isDifficulty(value: unknown): value is Difficulty {
  return typeof value === "string" && (DIFFICULTIES as readonly string[]).includes(value);
}

export function difficultyLabel(d: Difficulty): string {
  return DIFFICULTY_META[d].label;
}
