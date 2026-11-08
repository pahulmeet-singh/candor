import "server-only";
import { countActiveBookings, activeBookingsWhere, getSeatMap } from "@/lib/data/interviews";
import { INTERVIEW_SELECT, toInterviewDTO } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { isSerializationFailure } from "@/lib/prisma-errors";
import {
  BOOKABILITY_MESSAGE,
  SLOT_RULES,
  bookableDateKeys,
  checkBookable,
  slotEnd,
  slotStartsFor,
  slotState,
  type DateKey,
} from "@/lib/slots";
import type { InterviewDTO, SlotsResponse } from "@/lib/types";
import type { BookingInput } from "@/lib/validations/booking";

/**
 * Booking rules. Everything that decides "may this person take this seat?"
 * lives here, once, and is shared by the Server Action the booking page uses
 * and the REST Route Handler (`POST /api/interviews`).
 */

const MAX_ATTEMPTS = 3;

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** The 16 half-hour slots of one day, with how full each is for this user. */
export async function listSlots(userId: string, date: DateKey, now: Date = new Date()): Promise<SlotsResponse> {
  if (!bookableDateKeys(now).includes(date)) {
    const message = `Choose a date within the next ${SLOT_RULES.horizonDays - 1} days.`;
    throw new AppError("VALIDATION", message, { fieldErrors: { date: [message] } });
  }

  const [seats, activeBookings] = await Promise.all([getSeatMap(date, userId), countActiveBookings(userId, now)]);

  const slots = slotStartsFor(date).map((start) => {
    const booked = seats.booked.get(start.getTime()) ?? 0;
    return {
      start: start.toISOString(),
      end: slotEnd(start).toISOString(),
      booked,
      capacity: SLOT_RULES.capacity,
      state: slotState({ start, now, booked, mine: seats.mine.has(start.getTime()) }),
    };
  });

  return { date, slots, activeBookings, maxActiveBookings: SLOT_RULES.maxActivePerUser };
}

/**
 * Takes a seat. The checks and the insert run in one SERIALIZABLE transaction:
 * if two people race for the last seat, PostgreSQL lets one commit and aborts
 * the other (Prisma reports P2034), and we retry the loser. By then the seat
 * count is already 3, so the retry fails cleanly with SLOT_FULL instead of
 * overbooking. Without the transaction, "count, then insert" would let both through.
 */
export async function bookInterview(userId: string, input: BookingInput, now: Date = new Date()): Promise<InterviewDTO> {
  const issue = checkBookable(input.scheduledAt, now);
  if (issue) throw new AppError("SLOT_INVALID", BOOKABILITY_MESSAGE[issue]);

  let resumeId: string | null = null;
  if (input.useResume) {
    const resume = await prisma.resume.findUnique({ where: { userId }, select: { id: true } });
    if (!resume) {
      const message = "Upload a résumé first, or turn off tailored questions.";
      throw new AppError("VALIDATION", message, { fieldErrors: { useResume: [message] } });
    }
    resumeId = resume.id;
  }

  const demo = env.demoMode;

  for (let attempt = 1; ; attempt++) {
    try {
      const row = await prisma.$transaction(
        async (tx) => {
          const active = await tx.interview.count({ where: activeBookingsWhere(userId, now, demo) });
          if (active >= SLOT_RULES.maxActivePerUser) {
            throw new AppError(
              "LIMIT_REACHED",
              `You already hold ${SLOT_RULES.maxActivePerUser} upcoming interviews. Finish or cancel one before booking another.`,
            );
          }

          const duplicate = await tx.interview.findFirst({
            where: { userId, scheduledAt: input.scheduledAt, status: { not: "CANCELLED" } },
            select: { id: true },
          });
          if (duplicate) throw new AppError("CONFLICT", "You already booked this slot.");

          const taken = await tx.interview.count({
            where: { scheduledAt: input.scheduledAt, status: { not: "CANCELLED" } },
          });
          if (taken >= SLOT_RULES.capacity) {
            throw new AppError("SLOT_FULL", "That slot just filled up. Pick another time.");
          }

          return tx.interview.create({
            data: {
              userId,
              resumeId,
              category: input.category,
              difficulty: input.difficulty,
              scheduledAt: input.scheduledAt,
              durationMin: SLOT_RULES.lengthMinutes,
            },
            select: INTERVIEW_SELECT,
          });
        },
        { isolationLevel: "Serializable", maxWait: 5_000, timeout: 10_000 },
      );
      return toInterviewDTO(row, now, demo);
    } catch (error) {
      if (!isSerializationFailure(error)) throw error;
      logger.warn("booking.serialization_retry", { attempt, userId });
      if (attempt >= MAX_ATTEMPTS) {
        throw new AppError("CONFLICT", "Many people are booking right now. Please try again.", { cause: error });
      }
      await sleep(40 * attempt + Math.floor(Math.random() * 40));
    }
  }
}

/**
 * Cancels a booking that has not started. The status check is part of the
 * UPDATE's WHERE clause, so a double-click or a second tab cannot cancel
 * something that began in the meantime: one statement, no read-then-write gap.
 */
export async function cancelInterview(userId: string, id: string, now: Date = new Date()): Promise<InterviewDTO> {
  const result = await prisma.interview.updateMany({
    where: { id, userId, status: "SCHEDULED" },
    data: { status: "CANCELLED" },
  });

  if (result.count === 0) {
    const existing = await prisma.interview.findFirst({ where: { id, userId }, select: { status: true } });
    if (!existing) throw new AppError("NOT_FOUND", "We could not find that interview.");
    throw new AppError(
      "INVALID_STATE",
      existing.status === "CANCELLED"
        ? "This interview is already cancelled."
        : "Only interviews that have not started can be cancelled.",
    );
  }

  const row = await prisma.interview.findFirst({ where: { id, userId }, select: INTERVIEW_SELECT });
  if (!row) throw new AppError("NOT_FOUND", "We could not find that interview.");
  return toInterviewDTO(row, now, env.demoMode);
}
