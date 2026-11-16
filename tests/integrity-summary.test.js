import { test } from "node:test";
import assert from "node:assert/strict";
import { REVIEW_AT_POINTS, levelFor, pointsFor, summarizeIntegrity } from "@/lib/integrity/summary";
import { EVENT_LABELS, INTEGRITY_DISCLAIMER, INTEGRITY_EVENT_TYPES } from "@/lib/integrity/constants";

const START = "2026-11-12T10:00:00.000Z";
const CONTEXT = { sessionStartedAt: START, questionIds: ["q-a", "q-b", "q-c"] };

/** An ISO instant this many seconds after the session started. */
const at = (seconds) => new Date(Date.parse(START) + seconds * 1000).toISOString();

let nextId = 0;
function event(type, overrides = {}) {
  nextId += 1;
  return { id: `e${nextId}`, type, questionId: null, startedAt: at(0), durationMs: 0, detail: null, ...overrides };
}

const points = (type, durationMs = 0, chars) =>
  pointsFor({ type, durationMs, detail: chars === undefined ? null : { chars } });

test("pointsFor weighs each kind, and long events count for more up to a cap", () => {
  assert.equal(points("FACE_MISSING", 3_000), 2);
  assert.equal(points("FACE_MISSING", 10_000), 3);
  assert.equal(points("FACE_MISSING", 35_000), 5);
  assert.equal(points("FACE_MISSING", 600_000), 8); // 2 + the cap of 6
  assert.equal(points("MULTIPLE_FACES", 2_000), 4);
  assert.equal(points("MULTIPLE_FACES", 600_000), 10);
  assert.equal(points("LOOKING_AWAY", 4_000), 1);
  assert.equal(points("LOOKING_AWAY", 600_000), 7);
  assert.equal(points("TAB_HIDDEN", 1_000), 3);
  assert.equal(points("TAB_HIDDEN", 25_000), 5);
  assert.equal(points("TAB_HIDDEN", 600_000), 9);
  assert.equal(points("CAMERA_OFF"), 2);
});

test("FOCUS_LOST is a flat point however long it lasted, and a negative duration cannot subtract", () => {
  assert.equal(points("FOCUS_LOST", 3_000), 1);
  assert.equal(points("FOCUS_LOST", 600_000), 1);
  assert.equal(points("FACE_MISSING", -5_000), 2);
});

test("a paste scores 2, or 4 once it is 200 characters or more", () => {
  assert.equal(points("PASTE", 0, 40), 2);
  assert.equal(points("PASTE", 0, 199), 2);
  assert.equal(points("PASTE", 0, 200), 4);
  assert.equal(points("PASTE", 0), 2); // no count recorded
});

test("levelFor: clear at 0, noted up to 5, review from 6", () => {
  assert.equal(REVIEW_AT_POINTS, 6);
  assert.equal(levelFor(0), "CLEAR");
  assert.equal(levelFor(1), "NOTED");
  assert.equal(levelFor(REVIEW_AT_POINTS - 1), "NOTED");
  assert.equal(levelFor(REVIEW_AT_POINTS), "REVIEW");
  assert.equal(levelFor(50), "REVIEW");
});

test("no events means CLEAR, with an empty timeline", () => {
  assert.deepEqual(summarizeIntegrity([], CONTEXT), {
    level: "CLEAR",
    points: 0,
    headline: "No interruptions were noted.",
    totalEvents: 0,
    byType: [],
    timeline: [],
  });
});

test("the timeline is in time order, with offsets from the start and 1-based question numbers", () => {
  const summary = summarizeIntegrity(
    [
      event("TAB_HIDDEN", { id: "b", startedAt: at(95), durationMs: 12_000, questionId: "q-b" }),
      event("FACE_MISSING", { id: "a", startedAt: at(30), durationMs: 4_000, questionId: "q-a" }),
      event("PASTE", {
        id: "c",
        startedAt: at(200),
        detail: { chars: 312 },
        questionId: "not-a-question-of-this-interview",
      }),
    ],
    CONTEXT,
  );
  assert.deepEqual(summary.timeline, [
    {
      id: "a",
      type: "FACE_MISSING",
      label: EVENT_LABELS.FACE_MISSING,
      offsetMs: 30_000,
      durationMs: 4_000,
      questionNumber: 1,
      note: null,
    },
    {
      id: "b",
      type: "TAB_HIDDEN",
      label: EVENT_LABELS.TAB_HIDDEN,
      offsetMs: 95_000,
      durationMs: 12_000,
      questionNumber: 2,
      note: null,
    },
    {
      id: "c",
      type: "PASTE",
      label: EVENT_LABELS.PASTE,
      offsetMs: 200_000,
      durationMs: 0,
      questionNumber: null,
      note: "312 characters",
    },
  ]);
});

test("an event stamped before the start is clamped to 0, and an unknown start gives 0 offsets", () => {
  const early = event("CAMERA_OFF", { startedAt: at(-5) });
  assert.equal(summarizeIntegrity([early], CONTEXT).timeline[0]?.offsetMs, 0);

  const later = event("CAMERA_OFF", { startedAt: at(40) });
  assert.equal(summarizeIntegrity([later], { sessionStartedAt: null, questionIds: [] }).timeline[0]?.offsetMs, 0);
});

test("events at the same instant are ordered by id, so the report never reshuffles", () => {
  const same = at(10);
  const summary = summarizeIntegrity(
    [event("FOCUS_LOST", { id: "z", startedAt: same }), event("CAMERA_OFF", { id: "m", startedAt: same })],
    CONTEXT,
  );
  assert.deepEqual(
    summary.timeline.map((entry) => entry.id),
    ["m", "z"],
  );
});

test("byType counts and totals each kind that happened, in a fixed order, and leaves out the rest", () => {
  const summary = summarizeIntegrity(
    [
      event("TAB_HIDDEN", { startedAt: at(10), durationMs: 5_000 }),
      event("FACE_MISSING", { startedAt: at(20), durationMs: 3_000 }),
      event("TAB_HIDDEN", { startedAt: at(30), durationMs: 7_000 }),
    ],
    CONTEXT,
  );
  assert.equal(summary.totalEvents, 3);
  assert.deepEqual(summary.byType, [
    { type: "FACE_MISSING", label: EVENT_LABELS.FACE_MISSING, count: 1, totalMs: 3_000 },
    { type: "TAB_HIDDEN", label: EVENT_LABELS.TAB_HIDDEN, count: 2, totalMs: 12_000 },
  ]);
});

test("one large paste is NOTED, and a paste plus leaving the tab is REVIEW", () => {
  const paste = event("PASTE", { startedAt: at(60), detail: { chars: 450 } });
  const hidden = event("TAB_HIDDEN", { startedAt: at(90), durationMs: 2_000 });

  const one = summarizeIntegrity([paste], CONTEXT);
  assert.equal(one.points, 4);
  assert.equal(one.level, "NOTED");
  assert.equal(one.headline, "A few interruptions were noted.");

  const both = summarizeIntegrity([paste, hidden], CONTEXT);
  assert.equal(both.points, 7);
  assert.equal(both.level, "REVIEW");
  assert.match(both.headline, /look at the timeline/);
});

test("the wording accuses no one, and the disclaimer says plainly that flags are not proof", () => {
  const headlines = [
    summarizeIntegrity([], CONTEXT).headline,
    summarizeIntegrity([event("CAMERA_OFF")], CONTEXT).headline,
    summarizeIntegrity([event("MULTIPLE_FACES", { durationMs: 40_000 })], CONTEXT).headline,
  ];
  assert.equal(new Set(headlines).size, 3);
  for (const text of [...headlines, ...Object.values(EVENT_LABELS), INTEGRITY_DISCLAIMER]) {
    assert.doesNotMatch(text, /cheat|fraud|guilty|dishonest|suspicious/i);
  }
  assert.match(INTEGRITY_DISCLAIMER, /not proof/);
  assert.equal(Object.keys(EVENT_LABELS).length, INTEGRITY_EVENT_TYPES.length);
});

test("summarizeIntegrity leaves the array it is given alone", () => {
  const input = [
    event("PASTE", { id: "second", startedAt: at(50), detail: { chars: 60 } }),
    event("PASTE", { id: "first", startedAt: at(10), detail: { chars: 60 } }),
  ];
  const before = structuredClone(input);
  summarizeIntegrity(input, CONTEXT);
  assert.deepEqual(input, before);
});
