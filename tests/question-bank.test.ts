import { test } from "node:test";
import assert from "node:assert/strict";
import { CATEGORY_KEYS } from "@/lib/constants/categories";
import { DIFFICULTIES, DIFFICULTY_META } from "@/lib/constants/difficulty";
import { QUESTIONS_PER_SESSION } from "@/lib/constants/limits";
import { QUESTION_BANK, getBankQuestion, pickBankQuestions } from "@/lib/constants/question-bank";
import { transcriptQuestionSchema } from "@/lib/validations/session";

const ID_PREFIX: Record<string, string> = {
  FRONTEND: "fe-",
  BACKEND: "be-",
  DSA: "ds-",
  SYSTEM_DESIGN: "sd-",
  BEHAVIOURAL: "bh-",
  FULLSTACK_NEXT: "fs-",
};

test("every category has eight questions: three beginner, three intermediate, two advanced", () => {
  for (const key of CATEGORY_KEYS) {
    const list = QUESTION_BANK[key];
    assert.equal(list.length, 8, `${key} should have 8 questions`);
    const counts = Object.fromEntries(DIFFICULTIES.map((d) => [d, list.filter((q) => q.difficulty === d).length]));
    assert.deepEqual(counts, { BEGINNER: 3, INTERMEDIATE: 3, ADVANCED: 2 }, key);
  }
});

test("ids are unique, prefixed by category and resolvable", () => {
  const seen = new Set<string>();
  for (const key of CATEGORY_KEYS) {
    for (const q of QUESTION_BANK[key]) {
      assert.ok(q.id.startsWith(ID_PREFIX[key]), `${q.id} should start with ${ID_PREFIX[key]}`);
      assert.ok(!seen.has(q.id), `duplicate id ${q.id}`);
      seen.add(q.id);
      assert.equal(getBankQuestion(q.id), q);
    }
  }
  assert.equal(seen.size, 48);
  assert.equal(getBankQuestion("nope"), undefined);
  assert.equal(getBankQuestion(undefined), undefined);
});

test("every question fits the transcript schema and has a usable rubric", () => {
  for (const key of CATEGORY_KEYS) {
    for (const q of QUESTION_BANK[key]) {
      const parsed = transcriptQuestionSchema.safeParse({ id: "q1", text: q.text, topic: q.topic, seedId: q.id });
      assert.ok(parsed.success, `${q.id} does not fit the transcript schema`);
      assert.ok(q.rubric.length >= 3 && q.rubric.length <= 4, `${q.id} should have 3 or 4 rubric points`);
      for (const point of q.rubric) {
        assert.ok(point.anyOf.length > 0, `${q.id}: empty phrase list`);
        assert.ok((point.min ?? 1) <= point.anyOf.length, `${q.id}: min exceeds the phrase count`);
      }
      assert.ok(q.modelAnswer.length >= 200 && q.modelAnswer.length <= 1200, `${q.id}: model answer length`);
    }
  }
});

test("each model answer satisfies every point of its own rubric", () => {
  for (const key of CATEGORY_KEYS) {
    for (const q of QUESTION_BANK[key]) {
      const lower = q.modelAnswer.toLowerCase();
      for (const point of q.rubric) {
        const hits = point.anyOf.filter((phrase) => lower.includes(phrase.toLowerCase()));
        assert.ok(
          hits.length >= (point.min ?? 1),
          `${q.id}: the model answer does not cover "${point.label}" (hits: ${hits.join(", ") || "none"})`,
        );
      }
    }
  }
});

test("pickBankQuestions is deterministic, distinct and ordered by difficulty", () => {
  for (const key of CATEGORY_KEYS) {
    for (const difficulty of DIFFICULTIES) {
      const a = pickBankQuestions(key, difficulty, "seed-1");
      const b = pickBankQuestions(key, difficulty, "seed-1");
      assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
      assert.equal(a.length, QUESTIONS_PER_SESSION);
      assert.equal(new Set(a.map((q) => q.id)).size, QUESTIONS_PER_SESSION);
      const ranks = a.map((q) => DIFFICULTY_META[q.difficulty].rank);
      assert.deepEqual(ranks, [...ranks].sort((x, y) => x - y));
    }
  }
});

test("the difficulty mix leans towards the chosen level", () => {
  const tally = (difficulty: (typeof DIFFICULTIES)[number]) => {
    const picked = pickBankQuestions("BACKEND", difficulty, "mix");
    return Object.fromEntries(DIFFICULTIES.map((d) => [d, picked.filter((q) => q.difficulty === d).length]));
  };
  assert.deepEqual(tally("BEGINNER"), { BEGINNER: 3, INTERMEDIATE: 2, ADVANCED: 0 });
  assert.deepEqual(tally("INTERMEDIATE"), { BEGINNER: 1, INTERMEDIATE: 3, ADVANCED: 1 });
  assert.deepEqual(tally("ADVANCED"), { BEGINNER: 0, INTERMEDIATE: 3, ADVANCED: 2 });
});

test("different seeds give different selections at least some of the time", () => {
  const signatures = new Set<string>();
  for (let i = 0; i < 20; i++) {
    signatures.add(pickBankQuestions("FRONTEND", "INTERMEDIATE", `interview-${i}`).map((q) => q.id).join(","));
  }
  assert.ok(signatures.size > 1);
});
