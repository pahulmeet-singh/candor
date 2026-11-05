import { test } from "node:test";
import assert from "node:assert/strict";
import { EARLY_ENTRY_MINUTES, canCancel, canStart, deriveDisplayStatus, sessionWindow } from "@/lib/status";

const scheduledAt = new Date("2026-10-30T05:00:00Z");
const base = { status: "SCHEDULED" as const, scheduledAt, durationMin: 30 };
const at = (offsetMinutes: number) => new Date(scheduledAt.getTime() + offsetMinutes * 60_000);

test("the room opens ten minutes early and closes when the slot ends", () => {
  const { opensAt, closesAt } = sessionWindow(base);
  assert.equal(opensAt.getTime(), at(-EARLY_ENTRY_MINUTES).getTime());
  assert.equal(closesAt.getTime(), at(30).getTime());
});

test("a scheduled interview becomes MISSED only after its slot has ended", () => {
  assert.equal(deriveDisplayStatus(base, at(-60), false), "SCHEDULED");
  assert.equal(deriveDisplayStatus(base, at(29), false), "SCHEDULED");
  assert.equal(deriveDisplayStatus(base, at(31), false), "MISSED");
});

test("demo mode never derives MISSED", () => {
  assert.equal(deriveDisplayStatus(base, at(600), true), "SCHEDULED");
});

test("stored statuses other than SCHEDULED pass through unchanged", () => {
  for (const status of ["IN_PROGRESS", "COMPLETED", "CANCELLED"] as const) {
    assert.equal(deriveDisplayStatus({ ...base, status }, at(600), false), status);
  }
});

test("canStart respects the window outside demo mode", () => {
  assert.deepEqual(canStart(base, at(-30), false).ok, false);
  const early = canStart(base, at(-30), false);
  assert.equal(early.ok === false && early.reason, "TOO_EARLY");
  assert.equal(canStart(base, at(-10), false).ok, true);
  assert.equal(canStart(base, at(30), false).ok, true);
  const late = canStart(base, at(31), false);
  assert.equal(late.ok === false && late.reason, "MISSED");
});

test("demo mode lets a scheduled interview start at any time", () => {
  assert.equal(canStart(base, at(-5000), true).ok, true);
  assert.equal(canStart(base, at(5000), true).ok, true);
});

test("an in-progress interview can always be resumed; finished ones cannot restart", () => {
  assert.equal(canStart({ ...base, status: "IN_PROGRESS" }, at(5000), false).ok, true);
  const done = canStart({ ...base, status: "COMPLETED" }, at(0), true);
  assert.equal(done.ok === false && done.reason, "COMPLETED");
  const cancelled = canStart({ ...base, status: "CANCELLED" }, at(0), true);
  assert.equal(cancelled.ok === false && cancelled.reason, "CANCELLED");
});

test("only a scheduled booking can be cancelled", () => {
  assert.equal(canCancel("SCHEDULED"), true);
  assert.equal(canCancel("IN_PROGRESS"), false);
  assert.equal(canCancel("COMPLETED"), false);
  assert.equal(canCancel("CANCELLED"), false);
});
