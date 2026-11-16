import "server-only";
import { PAGE_SIZE } from "@/lib/constants/limits";
import { INTERVIEW_SELECT, parseTranscript, toInterviewDTO } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { SLOT_RULES, dayEnd, dayStart } from "@/lib/slots";

/**
 * Read-side queries for interviews. Every function takes the signed-in user's
 * id and puts it in the `where` clause, so one user can never read another's
 * rows. A lookup by id that fails the ownership check behaves exactly like a
 * missing row (`null`), which keeps ids from leaking whether a booking exists.
 */

const MS_PER_MINUTE = 60_000;

/** A SCHEDULED booking whose slot started before this instant has ended: it is "missed". */
function missedBefore(now) {
  return new Date(now.getTime() - SLOT_RULES.lengthMinutes * MS_PER_MINUTE);
}

/**
 * Bookings that still count as upcoming: in progress, or scheduled and not yet
 * over. In demo mode (see `lib/status.js`) a scheduled booking never expires.
 */
export function activeBookingsWhere(userId, now, demo) {
  return {
    userId,
    OR: [
      { status: "IN_PROGRESS" },
      demo ? { status: "SCHEDULED" } : { status: "SCHEDULED", scheduledAt: { gte: missedBefore(now) } },
    ],
  };
}

function pastWhere(userId, now, demo) {
  return {
    userId,
    OR: demo
      ? [{ status: "COMPLETED" }]
      : [{ status: "COMPLETED" }, { status: "SCHEDULED", scheduledAt: { lt: missedBefore(now) } }],
  };
}

const ORDER = {
  upcoming: { scheduledAt: "asc" },
  past: { scheduledAt: "desc" },
  cancelled: { scheduledAt: "desc" },
};

export async function listInterviews(userId, query, now = new Date()) {
  const demo = env.demoMode;
  const where = {
    upcoming: activeBookingsWhere(userId, now, demo),
    past: pastWhere(userId, now, demo),
    cancelled: { userId, status: "CANCELLED" },
  };

  // Three cheap counts give every tab its badge; the list itself is one query.
  const [upcoming, past, cancelled] = await Promise.all([
    prisma.interview.count({ where: where.upcoming }),
    prisma.interview.count({ where: where.past }),
    prisma.interview.count({ where: where.cancelled }),
  ]);
  const counts = { upcoming, past, cancelled };

  const total = counts[query.tab];
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(query.page, totalPages);

  const rows = await prisma.interview.findMany({
    where: where[query.tab],
    orderBy: ORDER[query.tab],
    select: INTERVIEW_SELECT,
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return {
    items: rows.map((row) => toInterviewDTO(row, now, demo)),
    page,
    pageSize: PAGE_SIZE,
    total,
    totalPages,
    tab: query.tab,
    counts,
  };
}

export async function getInterview(userId, id, now = new Date()) {
  const row = await prisma.interview.findFirst({
    where: { id, userId },
    select: { ...INTERVIEW_SELECT, transcript: true },
  });
  if (!row) return null;
  return {
    ...toInterviewDTO(row, now, env.demoMode),
    transcript: parseTranscript(row.transcript, `interview:${id}`),
  };
}

/** The next few sessions, soonest first (dashboard). */
export async function getUpcomingInterviews(userId, limit = 3, now = new Date()) {
  const demo = env.demoMode;
  const rows = await prisma.interview.findMany({
    where: activeBookingsWhere(userId, now, demo),
    orderBy: { scheduledAt: "asc" },
    select: INTERVIEW_SELECT,
    take: limit,
  });
  return rows.map((row) => toInterviewDTO(row, now, demo));
}

export async function countActiveBookings(userId, now = new Date()) {
  return prisma.interview.count({ where: activeBookingsWhere(userId, now, env.demoMode) });
}

/**
 * Seats taken per slot on one IST day, and which of those slots are the user's.
 * A day holds at most `capacity x slots` live rows (the booking transaction
 * enforces it), so reading the rows and counting here is cheaper than it looks
 * and avoids a GROUP BY.
 */
export async function getSeatMap(day, userId) {
  const rows = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: dayStart(day), lt: dayEnd(day) },
      status: { not: "CANCELLED" },
    },
    select: { scheduledAt: true, userId: true },
  });

  const booked = new Map();
  const mine = new Set();
  for (const row of rows) {
    const key = row.scheduledAt.getTime();
    booked.set(key, (booked.get(key) ?? 0) + 1);
    if (row.userId === userId) mine.add(key);
  }
  return { booked, mine };
}
