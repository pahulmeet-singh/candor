import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { getFeedback } from "@/lib/data/feedback";
import { prisma } from "@/lib/db";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";
import { bookInterview } from "@/lib/services/booking";
import { recordIntegrityEvents } from "@/lib/services/integrity";
import { startInterview, submitInterview } from "@/lib/services/session";
import { NOW, bookingInput, createUser, freshSlot, rejectsWith, resetDatabase } from "./helpers";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

const ANSWER = "I would clarify the goal, compare two options and say how I would verify the result.";

/** A user whose interview in the given mode has been booked and started, the moment its slot opens. */
async function runningFor(label, mode) {
  const user = await createUser(label);
  const startsAt = freshSlot();
  const overrides = mode === "ASSESSMENT" ? { mode, monitoringConsent: true } : {};
  const interview = await bookInterview(user.id, bookingInput(startsAt, overrides), NOW);
  const started = await startInterview(user.id, interview.id, startsAt);
  const questionIds = started.transcript?.questions.map((question) => question.id) ?? [];
  assert.ok(questionIds.length > 0, "the started interview should have questions");
  return { user, interview, startsAt, questionIds };
}

/** An event `secondsIn` seconds after the interview started, as a browser with a correct clock reports it. */
function event(startsAt, secondsIn, overrides = {}) {
  return {
    type: "FACE_MISSING",
    startedAtMs: startsAt.getTime() + secondsIn * SECOND,
    durationMs: 4 * SECOND,
    questionId: null,
    ...overrides,
  };
}

/** The batch a browser sends at `sentAt`. `clockErrorMs` is how far its clock is from the server's. */
function batchAt(sentAt, events, clockErrorMs = 0) {
  return { sentAtMs: sentAt.getTime() + clockErrorMs, events };
}

const minutesAfter = (start, minutes) => new Date(start.getTime() + minutes * MINUTE);

describe("integrity monitoring on a real PostgreSQL database", () => {
  before(resetDatabase);
  after(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("books an assessment only with consent, and records when it was given", async () => {
    const user = await createUser("consent");

    const refused = await rejectsWith(
      bookInterview(user.id, bookingInput(freshSlot(), { mode: "ASSESSMENT" }), NOW),
      "VALIDATION",
    );
    assert.ok(refused.fieldErrors?.monitoringConsent?.length, "the error names the consent field");
    assert.equal(await prisma.interview.count({ where: { userId: user.id } }), 0, "nothing was booked");

    const assessment = await bookInterview(
      user.id,
      bookingInput(freshSlot(), { mode: "ASSESSMENT", monitoringConsent: true }),
      NOW,
    );
    assert.equal(assessment.mode, "ASSESSMENT");
    const stored = await prisma.interview.findUniqueOrThrow({ where: { id: assessment.id } });
    assert.equal(stored.monitoringConsentAt?.toISOString(), NOW.toISOString(), "consent carries the server's clock");

    // Practice records no consent even if the box was ticked: there is nothing to consent to.
    const practice = await bookInterview(user.id, bookingInput(freshSlot(), { monitoringConsent: true }), NOW);
    assert.equal(practice.mode, "PRACTICE");
    const practiceRow = await prisma.interview.findUniqueOrThrow({ where: { id: practice.id } });
    assert.equal(practiceRow.monitoringConsentAt, null);
  });

  it("has database rules of its own, so a bug in the app cannot store the wrong thing", async () => {
    const user = await createUser("db-rules");
    const startsAt = freshSlot();

    // An assessment with no consent is refused by a CHECK constraint, not only by the app.
    await assert.rejects(
      prisma.interview.create({
        data: { userId: user.id, category: "FRONTEND", scheduledAt: startsAt, mode: "ASSESSMENT" },
      }),
    );
    assert.equal(await prisma.interview.count({ where: { userId: user.id } }), 0);

    const practice = await bookInterview(user.id, bookingInput(startsAt), NOW);
    await assert.rejects(prisma.interview.update({ where: { id: practice.id }, data: { mode: "ASSESSMENT" } }));
    const unchanged = await prisma.interview.findUniqueOrThrow({ where: { id: practice.id } });
    assert.equal(unchanged.mode, "PRACTICE");

    // Events: no negative durations, and `detail` may hold nothing but a character count.
    const base = { interviewId: practice.id, startedAt: startsAt };
    await assert.rejects(prisma.integrityEvent.create({ data: { ...base, type: "FACE_MISSING", durationMs: -1 } }));
    await assert.rejects(
      prisma.integrityEvent.create({
        data: { ...base, type: "PASTE", detail: { chars: 5, text: "the pasted answer" } },
      }),
    );
    await assert.rejects(prisma.integrityEvent.create({ data: { ...base, type: "PASTE", detail: { chars: "lots" } } }));
    assert.equal(await prisma.integrityEvent.count({ where: { interviewId: practice.id } }), 0);

    await prisma.integrityEvent.create({ data: { ...base, type: "PASTE", detail: { chars: 312 } } });
    assert.equal(await prisma.integrityEvent.count({ where: { interviewId: practice.id } }), 1);
  });

  it("records the events of a running assessment, tidied up by the server", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt, questionIds } = await runningFor("records", "ASSESSMENT");
    const [first] = questionIds;
    const now = minutesAfter(startsAt, 2);

    const result = await recordIntegrityEvents(
      user.id,
      interview.id,
      batchAt(now, [
        event(startsAt, 30, { type: "FACE_MISSING", questionId: first ?? null }),
        event(startsAt, 60, {
          type: "PASTE",
          durationMs: 99 * SECOND,
          questionId: "not-a-question",
          detail: { chars: 312 },
        }),
        event(startsAt, 90, { type: "TAB_HIDDEN", durationMs: 12 * SECOND }),
        event(startsAt, -3600, { type: "LOOKING_AWAY" }), // an hour before the interview began
      ]),
      now,
    );
    assert.deepEqual(result, { saved: 3, dropped: 1 });

    const rows = await prisma.integrityEvent.findMany({
      where: { interviewId: interview.id },
      orderBy: { startedAt: "asc" },
    });
    assert.deepEqual(
      rows.map((row) => row.type),
      ["FACE_MISSING", "PASTE", "TAB_HIDDEN"],
    );
    assert.deepEqual(
      rows.map((row) => row.startedAt.getTime() - startsAt.getTime()),
      [30 * SECOND, 60 * SECOND, 90 * SECOND],
    );
    assert.deepEqual(
      rows.map((row) => row.questionId),
      [first ?? null, null, null],
    );
    assert.deepEqual(
      rows.map((row) => row.durationMs),
      [4 * SECOND, 0, 12 * SECOND],
      "a paste is an instant, whatever duration the browser claimed",
    );
    assert.deepEqual(
      rows.map((row) => row.detail),
      [null, { chars: 312 }, null],
    );
  });

  it("lines events up with the server's clock when the browser's clock is wrong", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt } = await runningFor("skew", "ASSESSMENT");
    const now = minutesAfter(startsAt, 5);
    const fast = 7 * MINUTE;

    const result = await recordIntegrityEvents(
      user.id,
      interview.id,
      batchAt(now, [event(startsAt, 100, { startedAtMs: startsAt.getTime() + 100 * SECOND + fast })], fast),
      now,
    );
    assert.deepEqual(result, { saved: 1, dropped: 0 });

    const [row] = await prisma.integrityEvent.findMany({ where: { interviewId: interview.id } });
    assert.equal(row?.startedAt.getTime(), startsAt.getTime() + 100 * SECOND);
  });

  it("keeps both batches when two arrive at the same moment", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt } = await runningFor("overlap", "ASSESSMENT");
    const now = minutesAfter(startsAt, 3);

    const [one, two] = await Promise.all([
      recordIntegrityEvents(user.id, interview.id, batchAt(now, [event(startsAt, 20), event(startsAt, 40)]), now),
      recordIntegrityEvents(user.id, interview.id, batchAt(now, [event(startsAt, 60), event(startsAt, 80)]), now),
    ]);
    assert.equal(one.saved + two.saved, 4);
    assert.equal(await prisma.integrityEvent.count({ where: { interviewId: interview.id } }), 4);
  });

  it(
    "only accepts events for an assessment that is running and that the caller owns",
    { timeout: 60_000 },
    async () => {
      // A practice interview is never monitored.
      const practice = await runningFor("state-practice", "PRACTICE");
      const practiceNow = minutesAfter(practice.startsAt, 1);
      await rejectsWith(
        recordIntegrityEvents(
          practice.user.id,
          practice.interview.id,
          batchAt(practiceNow, [event(practice.startsAt, 10)]),
          practiceNow,
        ),
        "INVALID_STATE",
      );

      // An assessment that is booked but has not started.
      const idleUser = await createUser("state-idle");
      const idleStart = freshSlot();
      const idle = await bookInterview(
        idleUser.id,
        bookingInput(idleStart, { mode: "ASSESSMENT", monitoringConsent: true }),
        NOW,
      );
      const idleNow = minutesAfter(idleStart, 1);
      await rejectsWith(
        recordIntegrityEvents(idleUser.id, idle.id, batchAt(idleNow, [event(idleStart, 10)]), idleNow),
        "INVALID_STATE",
      );

      // Someone else's interview, and one that does not exist, both look like a missing one.
      const live = await runningFor("state-live", "ASSESSMENT");
      const liveNow = minutesAfter(live.startsAt, 1);
      const stranger = await createUser("state-stranger");
      const liveBatch = batchAt(liveNow, [event(live.startsAt, 10)]);
      await rejectsWith(recordIntegrityEvents(stranger.id, live.interview.id, liveBatch, liveNow), "NOT_FOUND");
      await rejectsWith(recordIntegrityEvents(live.user.id, "no-such-interview", liveBatch, liveNow), "NOT_FOUND");

      // The owner can record while it runs...
      assert.deepEqual(await recordIntegrityEvents(live.user.id, live.interview.id, liveBatch, liveNow), {
        saved: 1,
        dropped: 0,
      });

      // ...but once it is submitted the record is frozen.
      const [question] = live.questionIds;
      await submitInterview(
        live.user.id,
        live.interview.id,
        question ? { [question]: ANSWER } : undefined,
        minutesAfter(live.startsAt, 20),
      );
      const afterSubmit = minutesAfter(live.startsAt, 21);
      await rejectsWith(
        recordIntegrityEvents(
          live.user.id,
          live.interview.id,
          batchAt(afterSubmit, [event(live.startsAt, 400)]),
          afterSubmit,
        ),
        "INVALID_STATE",
      );

      // None of the refused batches left anything behind.
      assert.equal(await prisma.integrityEvent.count({ where: { interviewId: practice.interview.id } }), 0);
      assert.equal(await prisma.integrityEvent.count({ where: { interviewId: idle.id } }), 0);
      assert.equal(await prisma.integrityEvent.count({ where: { interviewId: live.interview.id } }), 1);
    },
  );

  it("stops at the per-interview limit without refusing the whole batch", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt } = await runningFor("limit", "ASSESSMENT");
    const now = minutesAfter(startsAt, 10);
    const limit = INTEGRITY_RULES.maxEventsPerInterview;

    await prisma.integrityEvent.createMany({
      data: Array.from({ length: limit - 2 }, (_, index) => ({
        interviewId: interview.id,
        type: "FOCUS_LOST",
        startedAt: new Date(startsAt.getTime() + index * SECOND),
        durationMs: 3 * SECOND,
      })),
    });

    const result = await recordIntegrityEvents(
      user.id,
      interview.id,
      batchAt(
        now,
        [400, 410, 420, 430, 440].map((secondsIn) => event(startsAt, secondsIn)),
      ),
      now,
    );
    assert.deepEqual(result, { saved: 2, dropped: 3 });
    assert.equal(await prisma.integrityEvent.count({ where: { interviewId: interview.id } }), limit);
  });

  it("puts a summary in an assessment's report and nothing in a practice report", { timeout: 90_000 }, async () => {
    const watched = await runningFor("report-assessment", "ASSESSMENT");
    const [question] = watched.questionIds;
    const now = minutesAfter(watched.startsAt, 10);
    await recordIntegrityEvents(
      watched.user.id,
      watched.interview.id,
      batchAt(now, [
        event(watched.startsAt, 120, { type: "TAB_HIDDEN", durationMs: 12 * SECOND, questionId: question ?? null }),
        event(watched.startsAt, 300, { type: "PASTE", durationMs: 0, detail: { chars: 250 } }),
      ]),
      now,
    );
    const done = await submitInterview(
      watched.user.id,
      watched.interview.id,
      question ? { [question]: ANSWER } : undefined,
      minutesAfter(watched.startsAt, 20),
    );

    const report = await getFeedback(watched.user.id, done.feedbackId);
    assert.ok(report?.integrity, "an assessment's report carries an integrity summary");
    assert.equal(report.interview.mode, "ASSESSMENT");
    assert.equal(report.integrity.totalEvents, 2);
    assert.equal(report.integrity.points, 8, "tab hidden for 12 s is 3 + 1, a paste of 200+ characters is 4");
    assert.equal(report.integrity.level, "REVIEW");
    assert.deepEqual(
      report.integrity.timeline.map((entry) => [entry.type, entry.offsetMs / SECOND, entry.questionNumber]),
      [
        ["TAB_HIDDEN", 120, 1],
        ["PASTE", 300, null],
      ],
    );

    const practice = await runningFor("report-practice", "PRACTICE");
    const [practiceQuestion] = practice.questionIds;
    const finished = await submitInterview(
      practice.user.id,
      practice.interview.id,
      practiceQuestion ? { [practiceQuestion]: ANSWER } : undefined,
      minutesAfter(practice.startsAt, 20),
    );
    const practiceReport = await getFeedback(practice.user.id, finished.feedbackId);
    assert.equal(practiceReport?.integrity, null);
    assert.equal(practiceReport?.interview.mode, "PRACTICE");

    // Nobody else can open the report, flags and all.
    const stranger = await createUser("report-stranger");
    assert.equal(await getFeedback(stranger.id, done.feedbackId), null);
  });

  it("deletes the events together with their user", { timeout: 60_000 }, async () => {
    const { user, interview, startsAt } = await runningFor("cascade", "ASSESSMENT");
    const now = minutesAfter(startsAt, 2);
    await recordIntegrityEvents(user.id, interview.id, batchAt(now, [event(startsAt, 30)]), now);
    assert.equal(await prisma.integrityEvent.count({ where: { interviewId: interview.id } }), 1);

    await prisma.user.delete({ where: { id: user.id } });
    assert.equal(await prisma.integrityEvent.count({ where: { interviewId: interview.id } }), 0);
  });
});
