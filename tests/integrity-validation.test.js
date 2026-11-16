import { test } from "node:test";
import assert from "node:assert/strict";
import { integrityBatchSchema, integrityEventSchema } from "@/lib/validations/integrity";
import { INTEGRITY_EVENT_TYPES, INTEGRITY_RULES } from "@/lib/integrity/constants";

const NOW = 1_800_000_000_000;
const valid = { type: "FACE_MISSING", startedAtMs: NOW, durationMs: 4_000, questionId: "cm1abc" };

const accepts = (value) => integrityEventSchema.safeParse(value).success;
const rejects = (value) => !integrityEventSchema.safeParse(value).success;

test("every event type the browser can report is accepted", () => {
  for (const type of INTEGRITY_EVENT_TYPES) {
    assert.equal(accepts({ ...valid, type }), true, type);
  }
  assert.equal(accepts({ ...valid, type: "PASTE", durationMs: 0, detail: { chars: 312 } }), true);
  assert.equal(accepts({ ...valid, questionId: null }), true);
});

test("an event type the server does not know is rejected", () => {
  assert.equal(rejects({ ...valid, type: "LOOKING_UP" }), true);
  assert.equal(rejects({ ...valid, type: "face_missing" }), true);
  assert.equal(rejects({ ...valid, type: undefined }), true);
});

test("timestamps must be whole, positive numbers", () => {
  assert.equal(rejects({ ...valid, startedAtMs: 0 }), true);
  assert.equal(rejects({ ...valid, startedAtMs: -1 }), true);
  assert.equal(rejects({ ...valid, startedAtMs: 1.5 }), true);
  assert.equal(rejects({ ...valid, startedAtMs: String(NOW) }), true);
  assert.equal(rejects({ ...valid, startedAtMs: Number.NaN }), true);
  assert.equal(rejects({ ...valid, startedAtMs: Number.POSITIVE_INFINITY }), true);
});

test("a duration is a whole number from 0 up to one hour", () => {
  assert.equal(accepts({ ...valid, durationMs: 0 }), true);
  assert.equal(accepts({ ...valid, durationMs: INTEGRITY_RULES.maxSpanMs }), true);
  assert.equal(rejects({ ...valid, durationMs: INTEGRITY_RULES.maxSpanMs + 1 }), true);
  assert.equal(rejects({ ...valid, durationMs: -1 }), true);
  assert.equal(rejects({ ...valid, durationMs: 1.5 }), true);
});

test("the question id is a short non-empty string or null, and may not be left out", () => {
  assert.equal(accepts({ ...valid, questionId: "x".repeat(32) }), true); // the transcript's own limit
  assert.equal(rejects({ ...valid, questionId: "" }), true);
  assert.equal(rejects({ ...valid, questionId: "x".repeat(33) }), true);
  assert.equal(rejects({ ...valid, questionId: 7 }), true);
  assert.equal(rejects({ type: valid.type, startedAtMs: valid.startedAtMs, durationMs: valid.durationMs }), true);
});

test("unknown keys are rejected rather than ignored, so no free text can ride along", () => {
  assert.equal(rejects({ ...valid, userId: "someone-else" }), true);
  assert.equal(rejects({ ...valid, type: "PASTE", detail: { chars: 5, text: "the pasted answer" } }), true);
  assert.equal(rejects({ ...valid, type: "PASTE", detail: { text: "the pasted answer" } }), true);
  const result = integrityEventSchema.safeParse({ ...valid, screenshot: "data:image/png;base64,AAAA" });
  assert.equal(result.success, false);
  if (!result.success) assert.ok(result.error.issues.some((issue) => issue.code === "unrecognized_keys"));
});

test("a paste's character count must be a whole number in range", () => {
  assert.equal(accepts({ ...valid, type: "PASTE", detail: { chars: 0 } }), true);
  assert.equal(accepts({ ...valid, type: "PASTE", detail: { chars: 1_000_000 } }), true);
  assert.equal(rejects({ ...valid, type: "PASTE", detail: { chars: 1_000_001 } }), true);
  assert.equal(rejects({ ...valid, type: "PASTE", detail: { chars: -1 } }), true);
  assert.equal(rejects({ ...valid, type: "PASTE", detail: { chars: 1.5 } }), true);
});

test("a batch holds between 1 and 50 events", () => {
  const batch = (count) => ({ sentAtMs: NOW, events: Array.from({ length: count }, () => ({ ...valid })) });
  assert.equal(integrityBatchSchema.safeParse(batch(1)).success, true);
  assert.equal(integrityBatchSchema.safeParse(batch(INTEGRITY_RULES.maxEventsPerRequest)).success, true);
  assert.equal(integrityBatchSchema.safeParse(batch(0)).success, false);
  assert.equal(integrityBatchSchema.safeParse(batch(INTEGRITY_RULES.maxEventsPerRequest + 1)).success, false);
  assert.equal(integrityBatchSchema.safeParse({}).success, false);
  assert.equal(integrityBatchSchema.safeParse({ events: "nope" }).success, false);
  assert.equal(integrityBatchSchema.safeParse([valid]).success, false);
});

test("a batch accepts nothing but a send time and events", () => {
  assert.equal(integrityBatchSchema.safeParse({ sentAtMs: NOW, events: [valid] }).success, true);
  assert.equal(
    integrityBatchSchema.safeParse({ sentAtMs: NOW, events: [valid], userId: "someone-else" }).success,
    false,
  );
});

test("the send time is required and must be a whole, positive number", () => {
  assert.equal(integrityBatchSchema.safeParse({ events: [valid] }).success, false);
  assert.equal(integrityBatchSchema.safeParse({ sentAtMs: 0, events: [valid] }).success, false);
  assert.equal(integrityBatchSchema.safeParse({ sentAtMs: -5, events: [valid] }).success, false);
  assert.equal(integrityBatchSchema.safeParse({ sentAtMs: 1.5, events: [valid] }).success, false);
  assert.equal(integrityBatchSchema.safeParse({ sentAtMs: String(NOW), events: [valid] }).success, false);
});

test("an error names the exact event and field that was wrong", () => {
  const result = integrityBatchSchema.safeParse({ sentAtMs: NOW, events: [valid, { ...valid, durationMs: -1 }] });
  assert.equal(result.success, false);
  if (!result.success) assert.deepEqual(result.error.issues[0]?.path, ["events", 1, "durationMs"]);
});
