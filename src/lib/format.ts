/**
 * Display formatting, always in IST and always built from `formatToParts`.
 * Server and browser ICU builds disagree on small things (am/AM, narrow
 * no-break spaces, "Sep" against "Sept"), which would trigger hydration
 * warnings if we relied on the pre-composed `format()` output or on the
 * locale's own abbreviations. So names are taken in full and cut to three
 * letters here, which gives the same text in every engine.
 */

import { SLOT_TIMEZONE } from "@/lib/slots";

type DateInput = string | number | Date;

const toDate = (value: DateInput): Date => (value instanceof Date ? value : new Date(value));

/** "September" -> "Sep", "Thursday" -> "Thu". */
const abbreviate = (name: string): string => name.slice(0, 3);

const dayParts = new Intl.DateTimeFormat("en-IN", {
  timeZone: SLOT_TIMEZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const longDayParts = new Intl.DateTimeFormat("en-IN", {
  timeZone: SLOT_TIMEZONE,
  day: "numeric",
  month: "long",
  year: "numeric",
});

const timeParts = new Intl.DateTimeFormat("en-IN", {
  timeZone: SLOT_TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** 24-hour clock hour, used only to choose a greeting. */
const hourParts = new Intl.DateTimeFormat("en-GB", { timeZone: SLOT_TIMEZONE, hour: "2-digit", hourCycle: "h23" });

function pick(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((p) => p.type === type)?.value ?? "";
}

/** "Fri, 30 Oct" */
export function formatDay(value: DateInput): string {
  const { weekday, day, month } = formatDayParts(value);
  return `${weekday}, ${day} ${month}`;
}

/** "30 October 2026" */
export function formatLongDate(value: DateInput): string {
  const p = longDayParts.formatToParts(toDate(value));
  return `${pick(p, "day")} ${pick(p, "month")} ${pick(p, "year")}`;
}

/** "10:30 am" */
export function formatTime(value: DateInput): string {
  const p = timeParts.formatToParts(toDate(value));
  return `${pick(p, "hour")}:${pick(p, "minute")} ${pick(p, "dayPeriod").toLowerCase()}`;
}

/** "Fri, 30 Oct, 10:30 am" */
export function formatDateTime(value: DateInput): string {
  return `${formatDay(value)}, ${formatTime(value)}`;
}

/** The pieces of a date badge: { weekday: "Fri", day: "30", month: "Oct" }. */
export function formatDayParts(value: DateInput): { weekday: string; day: string; month: string } {
  const p = dayParts.formatToParts(toDate(value));
  return { weekday: abbreviate(pick(p, "weekday")), day: pick(p, "day"), month: abbreviate(pick(p, "month")) };
}

/** "Good morning", "Good afternoon" or "Good evening" by the hour in IST. */
export function greetingFor(now: DateInput): string {
  const hour = Number(pick(hourParts.formatToParts(toDate(now)), "hour"));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "10:00 am to 10:30 am" for a slot. */
export function formatTimeRange(start: DateInput, end: DateInput): string {
  return `${formatTime(start)} to ${formatTime(end)}`;
}

const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "in 2 days", "3 hours ago", "yesterday". */
export function formatRelative(value: DateInput, now: DateInput = new Date()): string {
  const diff = toDate(value).getTime() - toDate(now).getTime();
  for (const [unit, ms] of UNITS) {
    if (Math.abs(diff) >= ms) return relative.format(Math.trunc(diff / ms), unit);
  }
  return "just now";
}

/** 83_000 -> "1:23". Used by the session timer. Negative values clamp to 0:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function pluralize(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}
