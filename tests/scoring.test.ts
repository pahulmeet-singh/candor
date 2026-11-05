import { test } from "node:test";
import assert from "node:assert/strict";
import { average, clampInt, countWords, overallScore, readinessOf, scoreTone } from "@/lib/scoring";

test("overallScore is the mean question score scaled to 100", () => {
  assert.equal(overallScore([10, 10, 10, 10, 10]), 100);
  assert.equal(overallScore([7, 8, 6, 9, 5]), 70);
  assert.equal(overallScore([0, 0, 0, 0, 0]), 0);
  assert.equal(overallScore([]), 0);
  assert.equal(overallScore([5, 6]), 55);
});

test("overallScore rounds to a whole number and stays in range", () => {
  assert.equal(overallScore([7, 7, 8]), 73); // 73.33
  assert.equal(overallScore([100, 100]), 100);
  assert.equal(overallScore([-5, -5]), 0);
});

test("clampInt rounds, clamps and survives NaN", () => {
  assert.equal(clampInt(7.6, 0, 10), 8);
  assert.equal(clampInt(-3, 0, 10), 0);
  assert.equal(clampInt(42, 0, 10), 10);
  assert.equal(clampInt(Number.NaN, 0, 10), 0);
  assert.equal(clampInt(Number.POSITIVE_INFINITY, 0, 10), 0);
});

test("average handles an empty list", () => {
  assert.equal(average([]), 0);
  assert.equal(average([2, 4]), 3);
});

test("readiness bands change at 50 and 75", () => {
  assert.equal(readinessOf(0), "NEEDS_WORK");
  assert.equal(readinessOf(49), "NEEDS_WORK");
  assert.equal(readinessOf(50), "ON_TRACK");
  assert.equal(readinessOf(74), "ON_TRACK");
  assert.equal(readinessOf(75), "INTERVIEW_READY");
  assert.equal(readinessOf(100), "INTERVIEW_READY");
});

test("scoreTone matches the readiness bands", () => {
  assert.equal(scoreTone(10), "low");
  assert.equal(scoreTone(60), "mid");
  assert.equal(scoreTone(90), "high");
});

test("countWords", () => {
  assert.equal(countWords(""), 0);
  assert.equal(countWords("   "), 0);
  assert.equal(countWords("one"), 1);
  assert.equal(countWords("  two   words\nand\tmore "), 4);
});
