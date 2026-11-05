import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SLOT_RULES,
  addDays,
  bookableDateKeys,
  checkBookable,
  dateKeyOf,
  dayEnd,
  dayStart,
  isDateKey,
  isOnSlotGrid,
  slotEnd,
  slotStartsFor,
  slotState,
} from "@/lib/slots";

const iso = (value: string) => new Date(value);

test("isDateKey accepts real calendar dates only", () => {
  assert.equal(isDateKey("2026-10-30"), true);
  assert.equal(isDateKey("2028-02-29"), true);
  assert.equal(isDateKey("2026-02-29"), false);
  assert.equal(isDateKey("2026-13-01"), false);
  assert.equal(isDateKey("2026-1-1"), false);
  assert.equal(isDateKey("tomorrow"), false);
});

test("dateKeyOf reads the IST calendar date, not the UTC one", () => {
  assert.equal(dateKeyOf(iso("2026-10-29T18:29:59Z")), "2026-10-29"); // 23:59:59 IST
  assert.equal(dateKeyOf(iso("2026-10-29T18:30:00Z")), "2026-10-30"); // 00:00:00 IST
  assert.equal(dateKeyOf(iso("2026-12-31T20:00:00Z")), "2027-01-01");
});

test("dayStart and dayEnd bracket one IST day", () => {
  assert.equal(dayStart("2026-10-30").toISOString(), "2026-10-29T18:30:00.000Z");
  assert.equal(dayEnd("2026-10-30").toISOString(), "2026-10-30T18:30:00.000Z");
});

test("addDays crosses month and year boundaries", () => {
  assert.equal(addDays("2026-10-30", 2), "2026-11-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2028-02-28", 1), "2028-02-29");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
});

test("a day has sixteen half-hour slots from 10:00 to 17:30 IST", () => {
  const starts = slotStartsFor("2026-10-30");
  assert.equal(starts.length, 16);
  assert.equal(starts[0].toISOString(), "2026-10-30T04:30:00.000Z"); // 10:00 IST
  assert.equal(starts[15].toISOString(), "2026-10-30T12:00:00.000Z"); // 17:30 IST
  assert.equal(slotEnd(starts[15]).toISOString(), "2026-10-30T12:30:00.000Z"); // 18:00 IST
});

test("isOnSlotGrid only accepts the half-hour grid inside opening hours", () => {
  assert.equal(isOnSlotGrid(iso("2026-10-30T04:30:00Z")), true); // 10:00
  assert.equal(isOnSlotGrid(iso("2026-10-30T12:00:00Z")), true); // 17:30
  assert.equal(isOnSlotGrid(iso("2026-10-30T04:45:00Z")), false); // 10:15
  assert.equal(isOnSlotGrid(iso("2026-10-30T04:00:00Z")), false); // 09:30
  assert.equal(isOnSlotGrid(iso("2026-10-30T12:30:00Z")), false); // 18:00
  assert.equal(isOnSlotGrid(iso("2026-10-30T04:30:01Z")), false);
});

test("bookableDateKeys covers today plus the next thirteen days", () => {
  const keys = bookableDateKeys(iso("2026-10-30T05:00:00Z"));
  assert.equal(keys.length, SLOT_RULES.horizonDays);
  assert.equal(keys[0], "2026-10-30");
  assert.equal(keys[13], "2026-11-12");
});

test("checkBookable explains why a start time is rejected", () => {
  const now = iso("2026-10-30T05:00:00Z"); // 10:30 IST
  assert.equal(checkBookable(iso("2026-10-30T04:45:00Z"), now), "OFF_GRID");
  assert.equal(checkBookable(iso("2026-10-30T04:30:00Z"), now), "TOO_SOON"); // 10:00, already started
  assert.equal(checkBookable(iso("2026-10-30T05:00:00Z"), now), "TOO_SOON"); // 10:30, starting right now
  assert.equal(checkBookable(iso("2026-10-30T05:30:00Z"), now), null); // 11:00, exactly 30 minutes ahead
});

test("checkBookable enforces the lead time exactly at the boundary", () => {
  const now = iso("2026-10-30T04:30:00Z"); // 10:00 IST
  assert.equal(checkBookable(iso("2026-10-30T05:00:00Z"), now), null); // 10:30, exactly 30 min ahead
  assert.equal(checkBookable(iso("2026-10-30T04:30:00Z"), now), "TOO_SOON");
});

test("checkBookable enforces the booking horizon", () => {
  const now = iso("2026-10-30T04:30:00Z");
  assert.equal(checkBookable(iso("2026-11-12T04:30:00Z"), now), null); // day 14 of 14
  assert.equal(checkBookable(iso("2026-11-13T04:30:00Z"), now), "TOO_FAR");
});

test("slotState: closed beats mine beats full beats open", () => {
  const now = iso("2026-10-30T04:30:00Z");
  const future = iso("2026-10-31T04:30:00Z");
  const past = iso("2026-10-30T04:30:00Z");
  assert.equal(slotState({ start: future, now, booked: 0, mine: false }), "open");
  assert.equal(slotState({ start: future, now, booked: SLOT_RULES.capacity - 1, mine: false }), "open");
  assert.equal(slotState({ start: future, now, booked: SLOT_RULES.capacity, mine: false }), "full");
  assert.equal(slotState({ start: future, now, booked: SLOT_RULES.capacity, mine: true }), "mine");
  assert.equal(slotState({ start: past, now, booked: 0, mine: true }), "closed");
});
