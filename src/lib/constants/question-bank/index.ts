import type { CategoryKey } from "@/lib/constants/categories";
import { DIFFICULTIES, DIFFICULTY_META, type Difficulty } from "@/lib/constants/difficulty";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import { seededRandom, shuffle } from "@/lib/random";
import { BACKEND_QUESTIONS } from "./backend";
import { BEHAVIOURAL_QUESTIONS } from "./behavioural";
import { DSA_QUESTIONS } from "./dsa";
import { FRONTEND_QUESTIONS } from "./frontend";
import { FULLSTACK_QUESTIONS } from "./fullstack";
import { SYSTEM_DESIGN_QUESTIONS } from "./system-design";
import type { BankQuestion } from "./types";

export type { BankQuestion, RubricPoint } from "./types";

/**
 * The offline question bank: six categories, eight questions each
 * (three beginner, three intermediate, two advanced). It powers AI_MODE=mock,
 * the seed script, the public sample report and the "model answer" text.
 */
export const QUESTION_BANK: Record<CategoryKey, readonly BankQuestion[]> = {
  FRONTEND: FRONTEND_QUESTIONS,
  BACKEND: BACKEND_QUESTIONS,
  DSA: DSA_QUESTIONS,
  SYSTEM_DESIGN: SYSTEM_DESIGN_QUESTIONS,
  BEHAVIOURAL: BEHAVIOURAL_QUESTIONS,
  FULLSTACK_NEXT: FULLSTACK_QUESTIONS,
};

const BY_ID = new Map<string, BankQuestion>(
  Object.values(QUESTION_BANK).flatMap((list) => list.map((q) => [q.id, q] as const)),
);

export function getBankQuestion(id: string | undefined): BankQuestion | undefined {
  return id === undefined ? undefined : BY_ID.get(id);
}

/**
 * How many questions come from each difficulty tier for a session. The chosen
 * difficulty dominates, with one tier of easier or harder questions mixed in so
 * a session has a warm-up and a stretch question. Every row sums to five.
 */
const MIX: Record<Difficulty, Record<Difficulty, number>> = {
  BEGINNER: { BEGINNER: 3, INTERMEDIATE: 2, ADVANCED: 0 },
  INTERMEDIATE: { BEGINNER: 1, INTERMEDIATE: 3, ADVANCED: 1 },
  ADVANCED: { BEGINNER: 0, INTERMEDIATE: 3, ADVANCED: 2 },
};

/**
 * Choose a session's questions from the bank: deterministic for a given seed,
 * ordered from easier to harder.
 */
export function pickBankQuestions(
  category: CategoryKey,
  difficulty: Difficulty,
  seed: string,
  count: number = QUESTIONS_PER_SESSION,
): BankQuestion[] {
  const pool = QUESTION_BANK[category];
  const rand = seededRandom(`${seed}:${category}:${difficulty}`);
  const picked: BankQuestion[] = [];

  for (const tier of DIFFICULTIES) {
    const want = MIX[difficulty][tier];
    if (want === 0) continue;
    picked.push(...shuffle(pool.filter((q) => q.difficulty === tier), rand).slice(0, want));
  }

  if (picked.length < count) {
    const taken = new Set(picked.map((q) => q.id));
    picked.push(...shuffle(pool.filter((q) => !taken.has(q.id)), rand).slice(0, count - picked.length));
  }

  return picked
    .slice(0, count)
    .sort((a, b) => DIFFICULTY_META[a.difficulty].rank - DIFFICULTY_META[b.difficulty].rank);
}
