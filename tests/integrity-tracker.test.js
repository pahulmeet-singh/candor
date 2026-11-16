import { test } from "node:test";
import assert from "node:assert/strict";
import { IntegrityTracker, SpanTracker } from "@/lib/integrity/tracker";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";

/* ───────────────────────── SpanTracker: one yes/no condition over time ───────────────────────── */

/** Feeds the same answer every `step` ms from `fromMs` to `toMs` (inclusive) and collects any span that comes back. */
function feed(tracker, active, fromMs, toMs, step = 200) {
  const spans = [];
  for (let at = fromMs; at <= toMs; at += step) {
    const span = tracker.update(active, at);
    if (span) spans.push(span);
  }
  return spans;
}

test("SpanTracker reports a condition once it has lasted long enough and then stopped", () => {
  const tracker = new SpanTracker(3000, 700);
  assert.deepEqual(feed(tracker, true, 1000, 4000), []); // still going on
  assert.deepEqual(feed(tracker, false, 4200, 4600), []); // stopped, but inside the grace period
  assert.deepEqual(feed(tracker, false, 4800, 4800), [{ startedAtMs: 1000, durationMs: 3000, questionId: null }]);
});

test("SpanTracker drops a condition that did not last long enough", () => {
  const tracker = new SpanTracker(3000, 700);
  feed(tracker, true, 0, 2000); // two seconds
  assert.deepEqual(feed(tracker, false, 2200, 5000), []);
  assert.equal(tracker.flush(6000), null); // and nothing is left open afterwards
});

test("SpanTracker rides out a flicker shorter than the grace period", () => {
  const tracker = new SpanTracker(3000, 700);
  feed(tracker, true, 0, 1000);
  assert.deepEqual(feed(tracker, false, 1200, 1400), []); // two missed samples, 400 ms
  feed(tracker, true, 1600, 3600);
  assert.deepEqual(feed(tracker, false, 3800, 4400), [{ startedAtMs: 0, durationMs: 3600, questionId: null }]);
});

test("SpanTracker splits a condition that stops for longer than the grace period", () => {
  const tracker = new SpanTracker(3000, 700);
  feed(tracker, true, 0, 2000);
  const spans = [
    ...feed(tracker, false, 2200, 3000), // a full second of "no": the first span was only 2 s, so it is dropped
    ...feed(tracker, true, 3200, 6400), // then a second, longer one
    ...feed(tracker, false, 6600, 7400),
  ];
  assert.deepEqual(spans, [{ startedAtMs: 3200, durationMs: 3200, questionId: null }]);
});

test("SpanTracker does not bridge a stretch with no samples at all", () => {
  const tracker = new SpanTracker(1000, 700);
  feed(tracker, true, 0, 1000); // a second of the condition...
  // ...then the page was throttled and nothing was sampled for nine seconds. The old span ends where it was last seen.
  assert.deepEqual(tracker.update(true, 10_000), { startedAtMs: 0, durationMs: 1000, questionId: null });
  // The sighting at 10 s starts a fresh span rather than stretching the old one.
  feed(tracker, true, 10_200, 11_000);
  assert.deepEqual(tracker.flush(11_000), { startedAtMs: 10_000, durationMs: 1000, questionId: null });
});

test("SpanTracker.flush closes an open span at its last sighting", () => {
  const tracker = new SpanTracker(3000, 700);
  assert.equal(tracker.flush(0), null); // nothing open yet
  feed(tracker, true, 0, 3000);
  assert.deepEqual(tracker.flush(3100), { startedAtMs: 0, durationMs: 3000, questionId: null });
  assert.equal(tracker.flush(3200), null); // already closed
});

test("a span remembers the question that was on screen when it began", () => {
  const tracker = new SpanTracker(1000, 700);
  tracker.update(true, 0, "q1");
  tracker.update(true, 500, "q2");
  tracker.update(true, 1000, "q2");
  assert.deepEqual(tracker.flush(1000), { startedAtMs: 0, durationMs: 1000, questionId: "q1" });
});

test("an edge-triggered SpanTracker runs from one event to the next, with nothing in between", () => {
  const tracker = new SpanTracker(1000, 0, true);
  assert.equal(tracker.update(true, 5000, "q2"), null);
  assert.deepEqual(tracker.update(false, 9000), { startedAtMs: 5000, durationMs: 4000, questionId: "q2" });
});

test("an edge-triggered SpanTracker ignores repeats, drops short spans and closes at the flush time", () => {
  const tracker = new SpanTracker(1000, 0, true);
  tracker.update(true, 0);
  tracker.update(true, 100); // the same state reported again is not a new span
  assert.equal(tracker.update(false, 500), null); // half a second: too short
  tracker.update(true, 2000);
  assert.equal(tracker.flush(2600), null); // 0.6 s: still too short
  tracker.update(true, 3000);
  assert.deepEqual(tracker.flush(4500), { startedAtMs: 3000, durationMs: 1500, questionId: null });
});

/* ───────────────────────── IntegrityTracker: all the rules together ───────────────────────── */

const T0 = 1_800_000_000_000;
const STEP = INTEGRITY_RULES.detectEveryMs;
const FACING = { yaw: 0.02 };
const TURNED = { yaw: 0.6 };

/** The same camera picture every 200 ms from `fromMs` to `toMs` (offsets from T0, inclusive). */
function watch(tracker, fromMs, toMs, faces, questionId = "q1") {
  const drafts = [];
  for (let at = fromMs; at <= toMs; at += STEP) {
    drafts.push(...tracker.frame({ nowMs: T0 + at, faces, questionId }));
  }
  return drafts;
}

function page(tracker, atMs, hidden, focused, questionId = "q1") {
  return tracker.page({ nowMs: T0 + atMs, hidden, focused, questionId });
}

test("someone facing the screen all session produces no events", () => {
  const tracker = new IntegrityTracker();
  assert.deepEqual(watch(tracker, 0, 120_000, [FACING]), []);
  assert.deepEqual(tracker.flush(T0 + 120_000), []);
});

test("an empty chair for three seconds is FACE_MISSING, on the question that was showing", () => {
  const tracker = new IntegrityTracker();
  assert.deepEqual(watch(tracker, 0, 2800, [FACING], "q1"), []);
  assert.deepEqual(watch(tracker, 3000, 6000, [], "q2"), []); // still happening
  assert.deepEqual(watch(tracker, 6200, 7000, [FACING], "q2"), [
    { type: "FACE_MISSING", startedAtMs: T0 + 3000, durationMs: 3000, questionId: "q2" },
  ]);
});

test("a shorter absence is ignored", () => {
  const tracker = new IntegrityTracker();
  const events = [...watch(tracker, 0, 2800, []), ...watch(tracker, 3000, 8000, [FACING])];
  assert.deepEqual(events, []);
});

test("two faces for two seconds is MULTIPLE_FACES", () => {
  const tracker = new IntegrityTracker();
  const events = [
    ...watch(tracker, 0, 1000, [FACING]),
    ...watch(tracker, 1200, 3200, [FACING, FACING]),
    ...watch(tracker, 3400, 4400, [FACING]),
  ];
  assert.deepEqual(events, [{ type: "MULTIPLE_FACES", startedAtMs: T0 + 1200, durationMs: 2000, questionId: "q1" }]);
});

test("a head turned away for four seconds is LOOKING_AWAY", () => {
  const tracker = new IntegrityTracker();
  const events = [
    ...watch(tracker, 0, 1000, [FACING]),
    ...watch(tracker, 1200, 5200, [TURNED]),
    ...watch(tracker, 5400, 6400, [FACING]),
  ];
  assert.deepEqual(events, [{ type: "LOOKING_AWAY", startedAtMs: T0 + 1200, durationMs: 4000, questionId: "q1" }]);
});

test("a short glance away, or a small turn held for a long time, is not reported", () => {
  const tracker = new IntegrityTracker();
  const events = [
    ...watch(tracker, 0, 3000, [TURNED]), // three seconds
    ...watch(tracker, 3200, 9000, [FACING]),
    ...watch(tracker, 9200, 90_000, [{ yaw: 0.3 }]), // a long look, but under the 0.35 limit
  ];
  assert.deepEqual(events, []);
  assert.deepEqual(tracker.flush(T0 + 90_000), []);
});

test("one missed frame in the middle of a long look away does not split it", () => {
  const tracker = new IntegrityTracker();
  const events = [
    ...watch(tracker, 0, 2000, [TURNED]),
    ...watch(tracker, 2200, 2200, [FACING]), // the detector flickers for a single frame
    ...watch(tracker, 2400, 5000, [TURNED]),
    ...watch(tracker, 5200, 6200, [FACING]),
  ];
  assert.deepEqual(events, [{ type: "LOOKING_AWAY", startedAtMs: T0, durationMs: 5000, questionId: "q1" }]);
});

test("a face whose direction could not be measured is not treated as looking away", () => {
  const tracker = new IntegrityTracker();
  assert.deepEqual(watch(tracker, 0, 30_000, [{ yaw: null }]), []);
});

test("with two faces in view only MULTIPLE_FACES is reported, not LOOKING_AWAY as well", () => {
  const tracker = new IntegrityTracker();
  const events = [...watch(tracker, 0, 6000, [TURNED, FACING]), ...watch(tracker, 6200, 7200, [FACING])];
  assert.deepEqual(
    events.map((event) => event.type),
    ["MULTIPLE_FACES"],
  );
});

test("switching tabs is one TAB_HIDDEN event, not a pile of overlapping ones", () => {
  const tracker = new IntegrityTracker();
  // What a browser really does when you switch tabs: the window blurs first, then the tab is hidden...
  assert.deepEqual(page(tracker, 10_000, false, false), []);
  assert.deepEqual(page(tracker, 10_020, true, false), []);
  // ...and on the way back the tab shows first and the window regains focus a moment later.
  assert.deepEqual(page(tracker, 25_000, false, false), [
    { type: "TAB_HIDDEN", startedAtMs: T0 + 10_020, durationMs: 14_980, questionId: "q1" },
  ]);
  assert.deepEqual(page(tracker, 25_030, false, true), []);
});

test("clicking into another window for three seconds is FOCUS_LOST", () => {
  const tracker = new IntegrityTracker();
  assert.deepEqual(page(tracker, 0, false, false), []);
  assert.deepEqual(page(tracker, 2_900, false, true), []); // back after 2.9 s: too short
  assert.deepEqual(page(tracker, 5_000, false, false), []);
  assert.deepEqual(page(tracker, 8_000, false, true), [
    { type: "FOCUS_LOST", startedAtMs: T0 + 5_000, durationMs: 3_000, questionId: "q1" },
  ]);
});

test("a tab hidden for under a second is ignored", () => {
  const tracker = new IntegrityTracker();
  assert.deepEqual(page(tracker, 0, true, true), []);
  assert.deepEqual(page(tracker, 900, false, true), []);
});

test("pastes shorter than 40 characters are ordinary editing and are not recorded", () => {
  const tracker = new IntegrityTracker();
  assert.deepEqual(tracker.paste(T0, 39, "q1"), []);
  assert.deepEqual(tracker.paste(T0 + 1000.4, 40, "q1"), [
    { type: "PASTE", startedAtMs: T0 + 1000, durationMs: 0, questionId: "q1", detail: { chars: 40 } },
  ]);
});

test("a paste event carries only a character count, never the pasted text", () => {
  const [event] = new IntegrityTracker().paste(T0, 500, "q1");
  assert.ok(event);
  assert.deepEqual(Object.keys(event).sort(), ["detail", "durationMs", "questionId", "startedAtMs", "type"]);
  assert.deepEqual(Object.keys(event.detail ?? {}), ["chars"]);
});

test("an unavailable camera is recorded as an instant CAMERA_OFF event", () => {
  assert.deepEqual(new IntegrityTracker().cameraOff(T0 + 5, null), [
    { type: "CAMERA_OFF", startedAtMs: T0 + 5, durationMs: 0, questionId: null },
  ]);
});

test("flush closes the spans that are still open when the interview ends", () => {
  const tracker = new IntegrityTracker();
  page(tracker, 1000, true, false, "q3"); // left the tab and never came back
  watch(tracker, 0, 5000, [], "q3"); // an empty chair that never ended
  assert.deepEqual(tracker.flush(T0 + 9000), [
    { type: "FACE_MISSING", startedAtMs: T0, durationMs: 5000, questionId: "q3" },
    { type: "TAB_HIDDEN", startedAtMs: T0 + 1000, durationMs: 8000, questionId: "q3" },
  ]);
  assert.deepEqual(tracker.flush(T0 + 9100), []); // nothing left to close
});

test("custom thresholds are honoured", () => {
  const tracker = new IntegrityTracker({ ...INTEGRITY_RULES, faceMissingMs: 1000, lookingAwayYaw: 0.2 });
  const events = [
    ...watch(tracker, 0, 1000, []),
    ...watch(tracker, 1200, 2200, [FACING]),
    ...watch(tracker, 2400, 6400, [{ yaw: 0.25 }]),
    ...watch(tracker, 6600, 7600, [FACING]),
  ];
  assert.deepEqual(
    events.map((event) => event.type),
    ["FACE_MISSING", "LOOKING_AWAY"],
  );
});

test("the thresholds written in the docs and the study guide are the ones in force", () => {
  assert.deepEqual(
    {
      faceMissing: INTEGRITY_RULES.faceMissingMs,
      multipleFaces: INTEGRITY_RULES.multipleFacesMs,
      lookingAway: INTEGRITY_RULES.lookingAwayMs,
      yaw: INTEGRITY_RULES.lookingAwayYaw,
      tabHidden: INTEGRITY_RULES.tabHiddenMs,
      focusLost: INTEGRITY_RULES.focusLostMs,
      paste: INTEGRITY_RULES.pasteMinChars,
      grace: INTEGRITY_RULES.graceMs,
      detectEvery: INTEGRITY_RULES.detectEveryMs,
      flushEvery: INTEGRITY_RULES.flushEveryMs,
      perRequest: INTEGRITY_RULES.maxEventsPerRequest,
      perInterview: INTEGRITY_RULES.maxEventsPerInterview,
    },
    {
      faceMissing: 3000,
      multipleFaces: 2000,
      lookingAway: 4000,
      yaw: 0.35,
      tabHidden: 1000,
      focusLost: 3000,
      paste: 40,
      grace: 700,
      detectEvery: 200,
      flushEvery: 10_000,
      perRequest: 50,
      perInterview: 300,
    },
  );
});
