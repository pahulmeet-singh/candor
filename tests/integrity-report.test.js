import { test } from "node:test";
import assert from "node:assert/strict";
import { toFeedbackDetail, toInterviewDTO } from "@/lib/data/mappers";
import { EVENT_LABELS } from "@/lib/integrity/constants";
import { SAMPLE_REPORT } from "@/lib/sample-report";

/** What the report page does with rows from the database: turn them into the DTO the UI draws. */

const STARTED = new Date("2026-11-12T10:00:00.000Z");
const at = (seconds) => new Date(STARTED.getTime() + seconds * 1000);

const questionIds = SAMPLE_REPORT.transcript.questions.map((question) => question.id);
const [firstQuestion, secondQuestion] = questionIds;
assert.ok(firstQuestion && secondQuestion, "the sample transcript has questions");

let counter = 0;
function eventRow(overrides) {
  counter += 1;
  return { id: `ev${counter}`, questionId: null, startedAt: at(0), durationMs: 0, detail: null, ...overrides };
}

function reportRow(mode, events) {
  return {
    id: "report-1",
    interviewId: "interview-1",
    overallScore: SAMPLE_REPORT.overallScore,
    model: SAMPLE_REPORT.model,
    createdAt: at(1800),
    evaluation: SAMPLE_REPORT.evaluation,
    interview: {
      id: "interview-1",
      category: "FULLSTACK_NEXT",
      difficulty: "INTERMEDIATE",
      scheduledAt: at(-60),
      startedAt: STARTED,
      completedAt: at(1750),
      durationMin: 30,
      transcript: SAMPLE_REPORT.transcript,
      mode,
      integrityEvents: events,
    },
  };
}

function detailOf(row) {
  const detail = toFeedbackDetail(row);
  assert.ok(detail, "the row should map to a report");
  return detail;
}

test("a practice interview has no integrity section at all", () => {
  const detail = detailOf(reportRow("PRACTICE", []));
  assert.equal(detail.integrity, null);
  assert.equal(detail.interview.mode, "PRACTICE");
});

test("even if events somehow exist for a practice interview, they are never shown", () => {
  const stray = eventRow({ type: "TAB_HIDDEN", durationMs: 20_000 });
  assert.equal(detailOf(reportRow("PRACTICE", [stray])).integrity, null);
});

test("an assessment with nothing to report says so, instead of showing nothing", () => {
  const detail = detailOf(reportRow("ASSESSMENT", []));
  assert.equal(detail.interview.mode, "ASSESSMENT");
  assert.equal(detail.integrity?.level, "CLEAR");
  assert.equal(detail.integrity?.totalEvents, 0);
  assert.deepEqual(detail.integrity?.timeline, []);
});

test("an assessment turns the stored events into a timeline measured from the start of the session", () => {
  const detail = detailOf(
    reportRow("ASSESSMENT", [
      // Deliberately out of order: the report sorts them by time.
      eventRow({ id: "c", type: "PASTE", startedAt: at(200), questionId: secondQuestion, detail: { chars: 312 } }),
      eventRow({ id: "a", type: "FACE_MISSING", startedAt: at(30), durationMs: 4_000, questionId: firstQuestion }),
      eventRow({ id: "b", type: "TAB_HIDDEN", startedAt: at(95), durationMs: 12_000, questionId: secondQuestion }),
    ]),
  );

  assert.ok(detail.integrity);
  assert.equal(detail.integrity.totalEvents, 3);
  // 2 (face out of frame, 4 s) + 4 (tab hidden, 12 s: 3 + 1) + 4 (a paste of 200 characters or more)
  assert.equal(detail.integrity.points, 10);
  assert.equal(detail.integrity.level, "REVIEW");
  assert.deepEqual(detail.integrity.timeline, [
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
      questionNumber: 2,
      note: "312 characters",
    },
  ]);
});

test("an event that names a question this interview does not have shows no question number", () => {
  const detail = detailOf(
    reportRow("ASSESSMENT", [eventRow({ type: "FOCUS_LOST", questionId: "gone", durationMs: 4_000 })]),
  );
  assert.equal(detail.integrity?.timeline[0]?.questionNumber, null);
});

test("JSON read back from the database is checked rather than trusted", () => {
  const detail = detailOf(
    reportRow("ASSESSMENT", [
      eventRow({ id: "1", type: "PASTE", startedAt: at(10), detail: { chars: "lots" } }),
      eventRow({ id: "2", type: "PASTE", startedAt: at(20), detail: { chars: 90, text: "the pasted answer" } }),
      eventRow({ id: "3", type: "PASTE", startedAt: at(30), detail: "garbage" }),
      eventRow({ id: "4", type: "PASTE", startedAt: at(40), detail: [1, 2, 3] }),
      eventRow({ id: "5", type: "PASTE", startedAt: at(50), detail: null }),
    ]),
  );
  assert.deepEqual(
    detail.integrity?.timeline.map((entry) => entry.note),
    [null, "90 characters", null, null, null],
  );
  // Nothing but the count can reach the page, whatever was in the column.
  assert.doesNotMatch(JSON.stringify(detail.integrity), /the pasted answer/);
});

test("a report whose evaluation cannot be read is not shown at all, with or without events", () => {
  const broken = reportRow("ASSESSMENT", [eventRow({ type: "CAMERA_OFF" })]);
  broken.evaluation = { nonsense: true };
  assert.equal(toFeedbackDetail(broken), null);
});

test("interviews carry their mode", () => {
  const row = (mode) => ({
    id: "i1",
    category: "FRONTEND",
    difficulty: "INTERMEDIATE",
    mode,
    scheduledAt: at(3600),
    durationMin: 30,
    status: "SCHEDULED",
    startedAt: null,
    completedAt: null,
    resumeId: null,
    createdAt: at(-3600),
    feedback: null,
  });
  assert.equal(toInterviewDTO(row("PRACTICE"), STARTED, false).mode, "PRACTICE");
  assert.equal(toInterviewDTO(row("ASSESSMENT"), STARTED, false).mode, "ASSESSMENT");
});
