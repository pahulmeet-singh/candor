import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { PAGE_SIZE } from "@/lib/constants/limits";
import { INTERVIEW_SELECT, parseTranscript, toInterviewDTO } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { SLOT_RULES, dayEnd, dayStart, type DateKey } from "@/lib/slots";
import type { InterviewDetailDTO, InterviewDTO, Paginated } from "@/lib/types";
import type { InterviewListQuery } from "@/lib/validations/booking";

/**
 * Read-side queries for interviews. Every function takes the signed-in user's
 * id and puts it in the `where` clause, so one user can never read another's
 * rows. A lookup by id that fails the ownership check behaves exactly like a
 * missing row (`null`), which keeps ids from leaking whether a booking exists.
 */

const MS_PER_MINUTE = 60_000;

export type InterviewTab = InterviewListQuery["tab"];

/** A SCHEDULED booking whose slot started before this instant has ended: it is "missed". */
function missedBefore(now: Date): Date {
  return new Date(now.getTime() - SLOT_RULES.lengthMinutes * MS_PER_MINUTE);
}

/**
 * Bookings that still count as upcoming: in progress, or scheduled and not yet
 * over. In demo mode (see `lib/status.ts`) a scheduled booking never expires.
 */
export function activeBookingsWhere(userId: string, now: Date, demo: boolean): Prisma.InterviewWhereInput {
  return {
    userId,
    OR: [
      { status: "IN_PROGRESS" },
      demo ? { status: "SCHEDULED" } : { status: "SCHEDULED", scheduledAt: { gte: missedBefore(now) } },
    ],
  };
}

function pastWhere(userId: string, now: Date, demo: boolean): Prisma.InterviewWhereInput {
  return {
    userId,
    OR: demo
      ? [{ status: "COMPLETED" }]
      : [{ status: "COMPLETED" }, { status: "SCHEDULED", scheduledAt: { lt: missedBefore(now) } }],
  };
}

const ORDER: Record<InterviewTab, Prisma.InterviewOrderByWithRelationInput> = {
  upcoming: { scheduledAt: "asc" },
  past: { scheduledAt: "desc" },
  cancelled: { scheduledAt: "desc" },
};

export interface InterviewList extends Paginated<InterviewDTO> {
  tab: InterviewTab;
  counts: Record<InterviewTab, number>;
}

export async function listInterviews(
  userId: string,
  query: InterviewListQuery,
  now: Date = new Date(),
): Promise<InterviewList> {
  const demo = env.demoMode;
  const where: Record<InterviewTab, Prisma.InterviewWhereInput> = {
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

export async function getInterview(
  userId: string,
  id: string,
  now: Date = new Date(),
): Promise<InterviewDetailDTO | null> {
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
export async function getUpcomingInterviews(
  userId: string,
  limit = 3,
  now: Date = new Date(),
): Promise<InterviewDTO[]> {
  const demo = env.demoMode;
  const rows = await prisma.interview.findMany({
    where: activeBookingsWhere(userId, now, demo),
    orderBy: { scheduledAt: "asc" },
    select: INTERVIEW_SELECT,
    take: limit,
  });
  return rows.map((row) => toInterviewDTO(row, now, demo));
}

export async function countActiveBookings(userId: string, now: Date = new Date()): Promise<number> {
  return prisma.interview.count({ where: activeBookingsWhere(userId, now, env.demoMode) });
}

/**
 * Seats taken per slot on one IST day, and which of those slots are the user's.
 * A day holds at most `capacity x slots` live rows (the booking transaction
 * enforces it), so reading the rows and counting here is cheaper than it looks
 * and avoids a GROUP BY.
 */
export async function getSeatMap(
  day: DateKey,
  userId: string,
): Promise<{ booked: Map<number, number>; mine: Set<number> }> {
  const rows = await prisma.interview.findMany({
    where: {
      scheduledAt: { gte: dayStart(day), lt: dayEnd(day) },
      status: { not: "CANCELLED" },
    },
    select: { scheduledAt: true, userId: true },
  });

  const booked = new Map<number, number>();
  const mine = new Set<number>();
  for (const row of rows) {
    const key = row.scheduledAt.getTime();
    booked.set(key, (booked.get(key) ?? 0) + 1);
    if (row.userId === userId) mine.add(key);
  }
  return { booked, mine };
}
