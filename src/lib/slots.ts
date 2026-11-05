/**
 * Pure slot rules. No I/O, no framework imports, so they run identically in a
 * Server Component, a Route Handler, the booking wizard and the unit tests.
 *
 * All wall-clock reasoning is done in India Standard Time (UTC+05:30, no DST),
 * which is how the platform advertises its slots. Instants are stored in the
 * database as UTC `timestamptz`.
 */

export const SLOT_TIMEZONE = "Asia/Kolkata";
export const IST_OFFSET_MINUTES = 330;

export const SLOT_RULES = {
  /** First slot starts at 10:00 IST. */
  startHour: 10,
  /** Last slot ends at 18:00 IST (so the last start is 17:30). */
  endHour: 18,
  lengthMinutes: 30,
  /** Interviews that may share one slot. */
  capacity: 3,
  /** Today plus the next 13 days. */
  horizonDays: 14,
  /** A slot stops being bookable this long before it starts. */
  minLeadMinutes: 30,
  /** Upcoming (scheduled or in-progress) bookings one user may hold. */
  maxActivePerUser: 5,
} as const;

/** `YYYY-MM-DD` interpreted in IST. */
export type DateKey = string;

const MS_PER_MINUTE = 60_000;
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

const pad = (n: number): string => String(n).padStart(2, "0");

/** Shift an instant so that the UTC getters read as IST wall-clock values. */
function asIst(instant: Date): Date {
  return new Date(instant.getTime() + IST_OFFSET_MINUTES * MS_PER_MINUTE);
}

function parseKey(key: DateKey): [number, number, number] {
  const [y, m, d] = key.split("-").map(Number);
  return [y, m, d];
}

export function isDateKey(value: string): value is DateKey {
  if (!DATE_KEY.test(value)) return false;
  const [y, m, d] = parseKey(value);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d;
}

/** The IST calendar date an instant falls on. */
export function dateKeyOf(instant: Date): DateKey {
  const s = asIst(instant);
  return `${s.getUTCFullYear()}-${pad(s.getUTCMonth() + 1)}-${pad(s.getUTCDate())}`;
}

/** The instant at which this IST date begins (00:00 IST). */
export function dayStart(key: DateKey): Date {
  const [y, m, d] = parseKey(key);
  return new Date(Date.UTC(y, m - 1, d) - IST_OFFSET_MINUTES * MS_PER_MINUTE);
}

/** The instant at which the next IST date begins. */
export function dayEnd(key: DateKey): Date {
  return dayStart(addDays(key, 1));
}

export function addDays(key: DateKey, days: number): DateKey {
  const [y, m, d] = parseKey(key);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Every slot start (as an instant) on the given IST date, in order. */
export function slotStartsFor(key: DateKey): Date[] {
  const base = dayStart(key).getTime();
  const starts: Date[] = [];
  for (
    let minute = SLOT_RULES.startHour * 60;
    minute < SLOT_RULES.endHour * 60;
    minute += SLOT_RULES.lengthMinutes
  ) {
    starts.push(new Date(base + minute * MS_PER_MINUTE));
  }
  return starts;
}

export function slotEnd(start: Date): Date {
  return new Date(start.getTime() + SLOT_RULES.lengthMinutes * MS_PER_MINUTE);
}

/** The dates a user can browse in the booking calendar, today first. */
export function bookableDateKeys(now: Date): DateKey[] {
  const today = dateKeyOf(now);
  return Array.from({ length: SLOT_RULES.horizonDays }, (_, i) => addDays(today, i));
}

/** True when the instant is exactly on a slot boundary inside opening hours. */
export function isOnSlotGrid(start: Date): boolean {
  const s = asIst(start);
  if (s.getUTCSeconds() !== 0 || s.getUTCMilliseconds() !== 0) return false;
  const minuteOfDay = s.getUTCHours() * 60 + s.getUTCMinutes();
  const open = SLOT_RULES.startHour * 60;
  const close = SLOT_RULES.endHour * 60;
  return minuteOfDay >= open && minuteOfDay < close && (minuteOfDay - open) % SLOT_RULES.lengthMinutes === 0;
}

export type BookabilityIssue = "OFF_GRID" | "TOO_SOON" | "TOO_FAR";

/** Why a requested start time cannot be booked, or `null` when it can. */
export function checkBookable(start: Date, now: Date): BookabilityIssue | null {
  if (!isOnSlotGrid(start)) return "OFF_GRID";
  if (start.getTime() < now.getTime() + SLOT_RULES.minLeadMinutes * MS_PER_MINUTE) return "TOO_SOON";
  const lastBookableDay = addDays(dateKeyOf(now), SLOT_RULES.horizonDays - 1);
  if (dateKeyOf(start) > lastBookableDay) return "TOO_FAR"; // ISO date keys sort lexically
  return null;
}

export type SlotState = "open" | "full" | "mine" | "closed";

/** What the booking grid shows for one slot. Closed beats mine beats full beats open. */
export function slotState(args: { start: Date; now: Date; booked: number; mine: boolean }): SlotState {
  if (checkBookable(args.start, args.now) !== null) return "closed";
  if (args.mine) return "mine";
  if (args.booked >= SLOT_RULES.capacity) return "full";
  return "open";
}

export const BOOKABILITY_MESSAGE: Record<BookabilityIssue, string> = {
  OFF_GRID: "Pick one of the listed half-hour slots between 10:00 am and 6:00 pm IST.",
  TOO_SOON: `Slots close ${SLOT_RULES.minLeadMinutes} minutes before they start. Pick a later one.`,
  TOO_FAR: `You can book up to ${SLOT_RULES.horizonDays - 1} days ahead.`,
};
