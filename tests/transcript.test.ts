import { test } from "node:test";
import assert from "node:assert/strict";
import { countAnswered, mergeAnswers } from "@/lib/transcript";
import { transcriptSchema, type Transcript } from "@/lib/validations/session";

const T0 = "2026-10-30T05:00:00.000Z";
const NOW = new Date("2026-10-30T05:20:00.000Z");

function base(): Transcript {
  return {
    questions: [
      { id: "q1", text: "What does the CSS box model describe?", topic: "CSS layout" },
      { id: "q2", text: "Explain what a closure is in JavaScript.", topic: "Closures" },
      { id: "q3", text: "How does React decide what to re-render?", topic: "React rendering" },
    ],
    answers: { q1: { text: "Content, padding, border and margin.", savedAt: T0 } },
    source: { provider: "mock", model: "candor-rubric-v1", generatedAt: T0, usedResume: false },
  };
}

test("mergeAnswers adds answers that were typed after the last autosave", () => {
  const merged = mergeAnswers(base(), { q2: "A closure keeps access to its outer scope." }, NOW);
  assert.equal(merged.answers.q2.text, "A closure keeps access to its outer scope.");
  assert.equal(merged.answers.q2.savedAt, NOW.toISOString());
  assert.equal(transcriptSchema.safeParse(merged).success, true);
});

test("an unchanged answer keeps its original savedAt; a changed one gets a new one", () => {
  const same = mergeAnswers(base(), { q1: "Content, padding, border and margin." }, NOW);
  assert.equal(same.answers.q1.savedAt, T0);

  const edited = mergeAnswers(base(), { q1: "Content, padding, border and margin, from inside to outside." }, NOW);
  assert.equal(edited.answers.q1.savedAt, NOW.toISOString());
});

test("ids that are not questions of this interview are ignored", () => {
  const merged = mergeAnswers(base(), { q42: "sneaky" }, NOW);
  assert.equal("q42" in merged.answers, false);
});

test("mergeAnswers never mutates its input and returns it untouched when there is nothing to merge", () => {
  const original = base();
  const snapshot = JSON.parse(JSON.stringify(original)) as Transcript;
  mergeAnswers(original, { q2: "A closure keeps access to its outer scope." }, NOW);
  assert.deepEqual(original, snapshot);
  assert.equal(mergeAnswers(original, undefined, NOW), original);
});

test("countAnswered counts only answers long enough to be assessed", () => {
  const t = base();
  assert.equal(countAnswered(t), 1);
  const more = mergeAnswers(t, { q2: "ok", q3: "React compares the new tree with the old one." }, NOW);
  assert.equal(countAnswered(more), 2); // "ok" is too short
});
