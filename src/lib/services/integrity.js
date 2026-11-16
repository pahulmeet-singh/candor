import "server-only";
import { parseTranscript } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { ingestEvents } from "@/lib/integrity/ingest";
import { INTEGRITY_RULES } from "@/lib/integrity/constants";
import { logger } from "@/lib/logger";

/**
 * Stores what the integrity monitor in the browser reports during an ASSESSMENT interview.
 *
 * The browser is not trusted: anyone can open the developer tools and send what they like, so the
 * decisions are made here. What is checked is in `ingestEvents` (a pure function with its own unit
 * tests); this function does the part that needs the database: who owns the interview, whether it
 * is monitored and running, and how many events it already holds.
 *
 * Delivery is at least once. If the response to a batch is lost, the browser sends it again and the
 * same events can be stored twice. That is accepted: the report only adds points up, in coarse
 * bands, so a repeated event nudges a number and never decides an outcome.
 */

const notFound = () => new AppError("NOT_FOUND", "We could not find that interview.");

export async function recordIntegrityEvents(userId, interviewId, batch, now = new Date()) {
  const row = await prisma.interview.findFirst({
    where: { id: interviewId, userId },
    select: {
      mode: true,
      status: true,
      startedAt: true,
      transcript: true,
      _count: { select: { integrityEvents: true } },
    },
  });
  if (!row) throw notFound();

  if (row.mode !== "ASSESSMENT") {
    throw new AppError("INVALID_STATE", "This interview is not being monitored.");
  }
  // Only while the session is running. After it is submitted the record is frozen, so nothing can
  // be added to, and so change, a finished report.
  if (row.status !== "IN_PROGRESS" || !row.startedAt) {
    throw new AppError("INVALID_STATE", "Integrity events are only recorded while the interview is in progress.");
  }

  const transcript = parseTranscript(row.transcript, `integrity:${interviewId}`);
  const { events, dropped } = ingestEvents(batch.events, {
    nowMs: now.getTime(),
    sentAtMs: batch.sentAtMs,
    sessionStartMs: row.startedAt.getTime(),
    questionIds: new Set(transcript?.questions.map((question) => question.id) ?? []),
    capacityLeft: Math.max(0, INTEGRITY_RULES.maxEventsPerInterview - row._count.integrityEvents),
  });

  if (events.length > 0) {
    await prisma.integrityEvent.createMany({
      data: events.map((event) => ({
        interviewId,
        type: event.type,
        questionId: event.questionId,
        startedAt: event.startedAt,
        durationMs: event.durationMs,
        // Left out (stored as NULL) unless it is a paste's character count.
        detail: event.detail || undefined,
      })),
    });
  }

  if (dropped > 0) logger.info("integrity.dropped", { interviewId, saved: events.length, dropped });
  return { saved: events.length, dropped };
}
