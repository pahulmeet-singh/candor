import "./setup";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/db";
import { isAppError } from "@/lib/errors";
import { bookableDateKeys, slotStartsFor } from "@/lib/slots";

/** A fixed clock for every test: Tuesday 10 November 2026, 09:30 in India. */
export const NOW = new Date("2026-11-10T04:00:00.000Z");

/** Slot number `index` (0 = 10:00 IST) on the day `dayOffset` days after NOW's date. */
export function slotAt(dayOffset, index) {
  const day = bookableDateKeys(NOW)[dayOffset];
  const slot = day ? slotStartsFor(day)[index] : undefined;
  if (!slot) throw new Error(`There is no slot ${index} on day +${dayOffset}.`);
  return slot;
}

let slotCursor = 0;

/** A different bookable slot on every call, so tests never compete for the same three seats. */
export function freshSlot() {
  const n = slotCursor++;
  return slotAt(1 + Math.floor(n / 16), n % 16);
}

export function bookingInput(scheduledAt, overrides = {}) {
  return {
    category: "FRONTEND",
    difficulty: "INTERMEDIATE",
    scheduledAt,
    useResume: false,
    mode: "PRACTICE",
    monitoringConsent: false,
    ...overrides,
  };
}

/**
 * Empties the tables the app writes to. Interviews, résumés, accounts and reports go with their
 * users through the foreign keys' ON DELETE CASCADE, which the schema test checks separately.
 */
export async function resetDatabase() {
  await prisma.user.deleteMany();
  await prisma.verificationToken.deleteMany();
}

export async function createUser(label, role = "USER") {
  return prisma.user.create({
    data: { name: label, email: `${label}-${randomUUID().slice(0, 8)}@integration.test`.toLowerCase(), role },
    select: { id: true, email: true },
  });
}

export async function createUsers(count, label) {
  return Promise.all(Array.from({ length: count }, (_, index) => createUser(`${label}-${index + 1}`)));
}

/** Asserts that `call` fails with an AppError carrying `code`, and returns that error for further checks. */
export async function rejectsWith(call, code) {
  let failure;
  try {
    await call;
  } catch (error) {
    failure = error;
  }
  assert.ok(failure !== undefined, `expected ${code}, but the call succeeded`);
  assert.ok(isAppError(failure), `expected an AppError with code ${code}, got: ${String(failure)}`);
  assert.equal(failure.code, code, `expected ${code}, got ${failure.code}: ${failure.message}`);
  return failure;
}

/** The error code of a rejection, or a description of what it was instead. */
export function codeOf(reason) {
  return isAppError(reason) ? reason.code : `not an AppError: ${String(reason)}`;
}
