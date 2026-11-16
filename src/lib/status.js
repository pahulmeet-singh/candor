/**
 * Interview lifecycle rules, kept pure so the same logic drives the server
 * checks (is this request allowed?) and the UI (which button do we show?).
 *
 * Stored status:   SCHEDULED -> IN_PROGRESS -> COMPLETED, or SCHEDULED -> CANCELLED.
 * Derived status:  a SCHEDULED interview whose slot has ended is shown as MISSED.
 * We derive it instead of storing it, so there is no cron job to keep in sync.
 */

const MS_PER_MINUTE = 60_000;

/** You may open the room this long before your slot starts. */
export const EARLY_ENTRY_MINUTES = 10;

export function sessionWindow(input) {
  return {
    opensAt: new Date(input.scheduledAt.getTime() - EARLY_ENTRY_MINUTES * MS_PER_MINUTE),
    closesAt: new Date(input.scheduledAt.getTime() + input.durationMin * MS_PER_MINUTE),
  };
}

export function deriveDisplayStatus(input, now, demo) {
  if (input.status !== "SCHEDULED") return input.status;
  if (demo) return "SCHEDULED";
  return now.getTime() > sessionWindow(input).closesAt.getTime() ? "MISSED" : "SCHEDULED";
}

export function canStart(input, now, demo) {
  const { opensAt, closesAt } = sessionWindow(input);
  if (input.status === "IN_PROGRESS") return { ok: true };
  if (input.status === "CANCELLED") return { ok: false, reason: "CANCELLED", opensAt };
  if (input.status === "COMPLETED") return { ok: false, reason: "COMPLETED", opensAt };
  if (demo) return { ok: true };
  if (now.getTime() < opensAt.getTime()) return { ok: false, reason: "TOO_EARLY", opensAt };
  if (now.getTime() > closesAt.getTime()) return { ok: false, reason: "MISSED", opensAt };
  return { ok: true };
}

/** Only a booking that has not started can be cancelled. */
export function canCancel(status) {
  return status === "SCHEDULED";
}

/** Statuses that count against a user's "active bookings" limit. */
export const ACTIVE_STATUSES = ["SCHEDULED", "IN_PROGRESS"];

export const STATUS_LABEL = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  MISSED: "Missed",
};
