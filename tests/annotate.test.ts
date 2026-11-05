import { test } from "node:test";
import assert from "node:assert/strict";
import { annotateAnswer, splitSentences } from "@/lib/annotate";

const answer =
  "A closure keeps access to its outer scope. It is used for private state, like a counter.\nThe event loop runs microtasks first.";

const rebuilt = (segments: { text: string }[]) => segments.map((s) => s.text).join("");

test("segments always reassemble into the original answer", () => {
  const result = annotateAnswer(answer, [{ quote: "private state" }, { quote: "microtasks first" }]);
  assert.equal(rebuilt(result.segments), answer);
  assert.deepEqual(result.unmatched, []);
  assert.deepEqual(
    result.segments.filter((s) => s.annotation !== null).map((s) => [s.text, s.annotation]),
    [
      ["private state", 0],
      ["microtasks first", 1],
    ],
  );
});

test("matching ignores case, whitespace and curly quotes", () => {
  const text = "It's the browser's job.\nThe parser   builds the DOM.";
  const result = annotateAnswer(text, [{ quote: "IT’S THE BROWSER’S JOB" }, { quote: "the parser builds the dom" }]);
  assert.deepEqual(result.unmatched, []);
  assert.equal(result.segments.filter((s) => s.annotation !== null).length, 2);
  assert.equal(rebuilt(result.segments), text);
});

test("surrounding punctuation and ellipses in a quote are tolerated", () => {
  const a = annotateAnswer(answer, [{ quote: '"A closure keeps access to its outer scope."' }]);
  assert.deepEqual(a.unmatched, []);
  const b = annotateAnswer(answer, [{ quote: "A closure keeps access … outer scope." }]);
  assert.deepEqual(b.unmatched, []);
});

test("quotes that are not in the answer are reported, not dropped", () => {
  const result = annotateAnswer(answer, [{ quote: "something the candidate never said" }, { quote: "private state" }]);
  assert.deepEqual(result.unmatched, [0]);
  assert.equal(rebuilt(result.segments), answer);
});

test("overlapping annotations keep the earliest and report the rest", () => {
  const result = annotateAnswer(answer, [{ quote: "keeps access to its outer scope" }, { quote: "access to its outer" }]);
  assert.deepEqual(result.unmatched, [1]);
  assert.equal(result.segments.filter((s) => s.annotation !== null).length, 1);
  assert.equal(rebuilt(result.segments), answer);
});

test("regex metacharacters in a quote are treated literally", () => {
  const text = "Use O(n log n) sorting (merge sort) for stability.";
  const result = annotateAnswer(text, [{ quote: "O(n log n) sorting" }]);
  assert.deepEqual(result.unmatched, []);
  assert.equal(result.segments[1]?.text, "O(n log n) sorting");
});

test("an empty answer yields one empty segment and everything unmatched", () => {
  const result = annotateAnswer("", [{ quote: "anything" }]);
  assert.equal(result.segments.length, 1);
  assert.deepEqual(result.unmatched, [0]);
});

test("splitSentences keeps punctuation and splits on newlines", () => {
  assert.deepEqual(splitSentences("One. Two! Three?\nFour"), ["One.", "Two!", "Three?", "Four"]);
  assert.deepEqual(splitSentences("  "), []);
});
