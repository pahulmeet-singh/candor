import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatBytes,
  formatClock,
  formatDateTime,
  formatDay,
  formatLongDate,
  formatRelative,
  formatTime,
  formatTimeRange,
  initialsOf,
  pluralize,
} from "@/lib/format";

test("times are shown in IST with a lower-case am/pm", () => {
  assert.equal(formatTime("2026-10-30T04:30:00Z"), "10:00 am");
  assert.equal(formatTime("2026-10-30T12:00:00Z"), "5:30 pm");
  assert.equal(formatTime("2026-10-30T18:30:00Z"), "12:00 am");
});

test("days and long dates", () => {
  assert.equal(formatDay("2026-10-30T04:30:00Z"), "Fri, 30 Oct");
  assert.equal(formatLongDate("2026-10-30T04:30:00Z"), "30 October 2026");
  assert.equal(formatDateTime("2026-10-30T04:30:00Z"), "Fri, 30 Oct, 10:00 am");
  assert.equal(formatTimeRange("2026-10-30T04:30:00Z", "2026-10-30T05:00:00Z"), "10:00 am to 10:30 am");
});

test("month and weekday abbreviations are always three letters, whatever the engine's locale data says", () => {
  // en-IN data in some engines spells September "Sept"; we cut the full name instead.
  assert.equal(formatDay("2026-09-29T06:00:00Z"), "Tue, 29 Sep");
  assert.equal(formatDay("2026-11-05T06:00:00Z"), "Thu, 5 Nov");
  const months = Array.from({ length: 12 }, (_, m) => formatDay(new Date(Date.UTC(2026, m, 15, 6)))).map((text) => text.split(" ")[2]);
  assert.deepEqual(months, ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]);
  const weekdays = Array.from({ length: 7 }, (_, d) => formatDay(new Date(Date.UTC(2026, 10, 2 + d, 6)))).map((text) => text.split(",")[0]);
  assert.deepEqual(weekdays, ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
});

test("the IST date, not the UTC date, decides the day", () => {
  assert.equal(formatDay("2026-10-29T19:00:00Z"), "Fri, 30 Oct"); // 00:30 IST on the 30th
});

test("formatClock clamps below zero and pads seconds", () => {
  assert.equal(formatClock(83_000), "1:23");
  assert.equal(formatClock(59_001), "1:00");
  assert.equal(formatClock(-5), "0:00");
  assert.equal(formatClock(0), "0:00");
});

test("formatBytes", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(2048), "2 KB");
  assert.equal(formatBytes(4 * 1024 * 1024), "4.0 MB");
});

test("pluralize and initialsOf", () => {
  assert.equal(pluralize(1, "interview"), "1 interview");
  assert.equal(pluralize(0, "interview"), "0 interviews");
  assert.equal(pluralize(2, "category", "categories"), "2 categories");
  assert.equal(initialsOf("Aarav Mehta"), "AM");
  assert.equal(initialsOf("  priya  "), "P");
  assert.equal(initialsOf("a b c"), "AC");
  assert.equal(initialsOf(""), "?");
});

test("formatRelative picks the largest sensible unit", () => {
  const now = new Date("2026-10-30T10:00:00Z");
  assert.equal(formatRelative("2026-11-01T10:00:00Z", now), "in 2 days");
  assert.equal(formatRelative("2026-10-30T07:00:00Z", now), "3 hours ago");
  assert.equal(formatRelative("2026-10-30T10:00:20Z", now), "just now");
});
