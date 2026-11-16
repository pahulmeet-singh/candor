import { test } from "node:test";
import assert from "node:assert/strict";
import { ingestEvents } from "@/lib/integrity/ingest";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";

const NOW = Date.parse("2026-11-12T10:30:00.000Z");
const START = NOW - 10 * 60_000; // the interview began ten minutes ago
const SLACK = INTEGRITY_RULES.clockSlackMs;

function context(overrides = {}) {
  return {
    nowMs: NOW,
    sentAtMs: NOW,
    sessionStartMs: START,
    questionIds: new Set(["q1", "q2"]),
    capacityLeft: 300,
    ...overrides,
  };
}

function draft(overrides = {}) {
  return { type: "FACE_MISSING", startedAtMs: NOW - 5 * 60_000, durationMs: 4_000, questionId: "q1", ...overrides };
}

test("an ordinary event inside the session is kept as it was reported", () => {
  const result = ingestEvents([draft()], context());
  assert.equal(result.dropped, 0);
  assert.deepEqual(result.events, [
    { type: "FACE_MISSING", questionId: "q1", startedAt: new Date(NOW - 5 * 60_000), durationMs: 4_000, detail: null },
  ]);
});

test("a browser clock that runs ten minutes fast is corrected onto the server's clock", () => {
  const fast = 10 * 60_000;
  const result = ingestEvents([draft({ startedAtMs: NOW - 5 * 60_000 + fast })], context({ sentAtMs: NOW + fast }));
  assert.equal(result.dropped, 0);
  assert.equal(result.events[0]?.startedAt.getTime(), NOW - 5 * 60_000);
});

test("a browser clock that runs three days slow is corrected too", () => {
  const slow = -3 * 24 * 3_600_000;
  const result = ingestEvents([draft({ startedAtMs: NOW - 2 * 60_000 + slow })], context({ sentAtMs: NOW + slow }));
  assert.equal(result.events[0]?.startedAt.getTime(), NOW - 2 * 60_000);
});

test("without the correction a fast clock would have every event refused as coming from the future", () => {
  // The same events, but pretending the browser's clock agrees with the server's.
  const fast = 10 * 60_000;
  const result = ingestEvents([draft({ startedAtMs: NOW - 5 * 60_000 + fast })], context({ sentAtMs: NOW }));
  assert.deepEqual(result.events, []);
  assert.equal(result.dropped, 1);
});

test("an event may begin up to a minute before the interview started, but not earlier", () => {
  assert.equal(ingestEvents([draft({ startedAtMs: START - SLACK })], context()).events.length, 1);
  const tooEarly = ingestEvents([draft({ startedAtMs: START - SLACK - 1 })], context());
  assert.deepEqual(tooEarly, { events: [], dropped: 1 });
});

test("an event may not end more than a minute after now", () => {
  const exactlyAtTheLimit = draft({ startedAtMs: NOW + SLACK - 4_000, durationMs: 4_000 });
  assert.equal(ingestEvents([exactlyAtTheLimit], context()).events.length, 1);
  const oneMsLater = draft({ startedAtMs: NOW + SLACK - 4_000 + 1, durationMs: 4_000 });
  assert.deepEqual(ingestEvents([oneMsLater], context()), { events: [], dropped: 1 });
});

test("a long span that ends in the future is refused even though it began inside the session", () => {
  const result = ingestEvents([draft({ startedAtMs: NOW - 1_000, durationMs: 30 * 60_000 })], context());
  assert.deepEqual(result, { events: [], dropped: 1 });
});

test("pastes and camera failures are instants: any duration the browser claims is thrown away", () => {
  const result = ingestEvents(
    [
      draft({ type: "PASTE", startedAtMs: NOW - 1_000, durationMs: 3_600_000, detail: { chars: 120 } }),
      draft({ type: "CAMERA_OFF", startedAtMs: NOW - 2_000, durationMs: 99_000 }),
    ],
    context(),
  );
  assert.equal(result.dropped, 0);
  assert.deepEqual(
    result.events.map((event) => event.durationMs),
    [0, 0],
  );
});

test("a question id that is not part of this interview is kept as no question at all", () => {
  const result = ingestEvents(
    [draft({ questionId: "q2" }), draft({ questionId: "someone-elses-question" }), draft({ questionId: null })],
    context(),
  );
  assert.deepEqual(
    result.events.map((event) => event.questionId),
    ["q2", null, null],
  );
});

test("only a paste keeps a detail, and the detail is only a character count", () => {
  const result = ingestEvents(
    [
      draft({ type: "PASTE", detail: { chars: 312 } }),
      draft({ type: "PASTE" }),
      draft({ type: "FACE_MISSING", detail: { chars: 5 } }),
    ],
    context(),
  );
  assert.deepEqual(
    result.events.map((event) => event.detail),
    [{ chars: 312 }, null, null],
  );
});

test("events beyond the interview's limit are dropped, oldest first kept", () => {
  const five = Array.from({ length: 5 }, (_, index) => draft({ startedAtMs: NOW - 60_000 + index * 1_000 }));
  const result = ingestEvents(five, context({ capacityLeft: 2 }));
  assert.deepEqual(
    result.events.map((event) => event.startedAt.getTime()),
    [NOW - 60_000, NOW - 59_000],
  );
  assert.equal(result.dropped, 3);
  assert.deepEqual(ingestEvents(five, context({ capacityLeft: 0 })), { events: [], dropped: 5 });
});

test("an event that would be refused anyway does not use up the limit", () => {
  const outside = draft({ startedAtMs: START - 3_600_000 });
  const inside = draft({ startedAtMs: NOW - 10_000 });
  const result = ingestEvents([outside, outside, inside, inside, inside], context({ capacityLeft: 2 }));
  assert.equal(result.events.length, 2);
  assert.equal(result.dropped, 3); // two outside the session, one over the limit
});

test("an empty batch gives an empty result", () => {
  assert.deepEqual(ingestEvents([], context()), { events: [], dropped: 0 });
});

test("the order is kept, and the input is left alone", () => {
  const input = [
    draft({ type: "TAB_HIDDEN", startedAtMs: NOW - 20_000 }),
    draft({ type: "FACE_MISSING", startedAtMs: NOW - 60_000 }),
  ];
  const before = structuredClone(input);
  const result = ingestEvents(input, context());
  assert.deepEqual(
    result.events.map((event) => event.type),
    ["TAB_HIDDEN", "FACE_MISSING"],
  );
  assert.deepEqual(input, before);
});

test("the slack is a rule that can be changed: with none, the interview's own start is the limit", () => {
  const rules = { ...INTEGRITY_RULES, clockSlackMs: 0 };
  assert.equal(ingestEvents([draft({ startedAtMs: START })], context(), rules).events.length, 1);
  assert.equal(ingestEvents([draft({ startedAtMs: START - 1 })], context(), rules).events.length, 0);
});
