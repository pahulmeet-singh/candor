import "server-only";
import { evaluateSession, generateQuestions } from "@/lib/ai";
import type { CategoryKey } from "@/lib/constants/categories";
import type { Difficulty } from "@/lib/constants/difficulty";
import { getInterview } from "@/lib/data/interviews";
import { parseTranscript } from "@/lib/data/mappers";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { formatDay, formatTime } from "@/lib/format";
import { logger } from "@/lib/logger";
import { toJson } from "@/lib/prisma-json";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { overallScore } from "@/lib/scoring";
import { canStart, type StartDecision } from "@/lib/status";
import { readResume } from "@/lib/supabase/storage";
import { mergeAnswers } from "@/lib/transcript";
import type { InterviewDetailDTO, InterviewStatus } from "@/lib/types";
import type { SaveAnswerInput, Transcript } from "@/lib/validations/session";

/**
 * The life of one interview after booking:
 *
 *   startInterview   SCHEDULED -> IN_PROGRESS, generates the questions
 *   saveAnswer       writes one answer into the transcript (autosave)
 *   submitInterview  IN_PROGRESS -> COMPLETED, evaluates and stores the report
 *
 * Each transition is a single conditional UPDATE (`... WHERE status = <expected>`),
 * so retries, double clicks and two open tabs cannot move an interview twice.
 */

const notFound = (): AppError => new AppError("NOT_FOUND", "We could not find that interview.");

function startRefusal(decision: Extract<StartDecision, { ok: false }>): AppError {
  switch (decision.reason) {
    case "TOO_EARLY":
      return new AppError(
        "INVALID_STATE",
        `The room opens at ${formatTime(decision.opensAt)} on ${formatDay(decision.opensAt)}.`,
      );
    case "MISSED":
      return new AppError("INVALID_STATE", "This slot has passed. Book a new one to practise again.");
    case "CANCELLED":
      return new AppError("INVALID_STATE", "This interview was cancelled.");
    case "COMPLETED":
      return new AppError("INVALID_STATE", "This interview is already complete. Open its report instead.");
  }
}

/** Reads the interview back after a transition; the caller needs the stored transcript. */
async function detailOrThrow(userId: string, id: string, now: Date): Promise<InterviewDetailDTO> {
  const detail = await getInterview(userId, id, now);
  if (!detail) throw notFound();
  return detail;
}

export async function startInterview(userId: string, id: string, now: Date = new Date()): Promise<InterviewDetailDTO> {
  const row = await prisma.interview.findFirst({
    where: { id, userId },
    select: {
      status: true,
      category: true,
      difficulty: true,
      scheduledAt: true,
      durationMin: true,
      transcript: true,
      resume: { select: { storagePath: true } },
    },
  });
  if (!row) throw notFound();

  const status = row.status as InterviewStatus;

  // Reloading the room must not generate a second set of questions.
  if (status === "IN_PROGRESS" && row.transcript) return detailOrThrow(userId, id, now);

  const decision = canStart({ status, scheduledAt: row.scheduledAt, durationMin: row.durationMin }, now, env.demoMode);
  if (!decision.ok) throw startRefusal(decision);

  // The résumé is only read when the booking asked for tailored questions.
  let resumePdf: Uint8Array | null = null;
  if (row.resume) {
    try {
      resumePdf = await readResume(row.resume.storagePath);
    } catch (error) {
      logger.warn("session.resume_unreadable", { interviewId: id, error });
    }
  }

  const generated = await generateQuestions({
    interviewId: id,
    category: row.category as CategoryKey,
    difficulty: row.difficulty as Difficulty,
    resumePdf,
  });
  const transcript: Transcript = { questions: generated.questions, answers: {}, source: generated.source };

  // `status: "SCHEDULED"` in the WHERE clause is the guard. If another tab won
  // the race (or the booking was cancelled while the model was thinking), no
  // row matches and we return whatever is stored instead of overwriting it.
  const claimed = await prisma.interview.updateMany({
    where: { id, userId, status: "SCHEDULED" },
    data: { status: "IN_PROGRESS", startedAt: now, transcript: toJson(transcript) },
  });
  if (claimed.count === 0) logger.info("session.start_lost_race", { interviewId: id });

  const detail = await detailOrThrow(userId, id, now);
  if (detail.status !== "IN_PROGRESS" || !detail.transcript) {
    throw new AppError("INVALID_STATE", "This interview can no longer be started.");
  }
  return detail;
}

/**
 * Writes one answer with a single atomic `jsonb_set`. The alternative, reading
 * the whole transcript, changing it in JavaScript and writing it back, would
 * lose an answer whenever two saves overlapped (two tabs, or a slow network
 * delivering saves out of order). Here the database patches only that key.
 */
export async function saveAnswer(
  userId: string,
  input: SaveAnswerInput,
  now: Date = new Date(),
): Promise<{ savedAt: string }> {
  const row = await prisma.interview.findFirst({
    where: { id: input.interviewId, userId },
    select: { status: true, transcript: true },
  });
  if (!row) throw notFound();
  if (row.status !== "IN_PROGRESS") {
    throw new AppError("INVALID_STATE", "This session is not open for answers.");
  }

  const transcript = parseTranscript(row.transcript, `save:${input.interviewId}`);
  if (!transcript?.questions.some((question) => question.id === input.questionId)) {
    throw new AppError("VALIDATION", "That question is not part of this session.");
  }

  const savedAt = now.toISOString();
  const entry = JSON.stringify({ text: input.text, savedAt });

  const updated = await prisma.$executeRaw`
    UPDATE "Interview"
    SET "transcript" = jsonb_set("transcript", ARRAY['answers', ${input.questionId}]::text[], ${entry}::jsonb, true),
        "updatedAt" = NOW()
    WHERE "id" = ${input.interviewId}
      AND "userId" = ${userId}
      AND "status" = 'IN_PROGRESS'
  `;
  if (updated === 0) throw new AppError("INVALID_STATE", "This session is not open for answers.");

  return { savedAt };
}

export interface SubmitResult {
  feedbackId: string;
  overallScore: number;
  /** True when the report already existed (a repeated submit returns it instead of failing). */
  alreadySubmitted: boolean;
}

export async function submitInterview(
  userId: string,
  id: string,
  answers: Record<string, string> | undefined,
  now: Date = new Date(),
): Promise<SubmitResult> {
  const row = await prisma.interview.findFirst({
    where: { id, userId },
    select: {
      category: true,
      difficulty: true,
      status: true,
      transcript: true,
      feedback: { select: { id: true, overallScore: true } },
    },
  });
  if (!row) throw notFound();

  if (row.feedback) {
    return { feedbackId: row.feedback.id, overallScore: row.feedback.overallScore, alreadySubmitted: true };
  }
  if (row.status !== "IN_PROGRESS") {
    throw new AppError("INVALID_STATE", "Start the session before submitting it.");
  }

  const stored = parseTranscript(row.transcript, `submit:${id}`);
  if (!stored) throw new AppError("INVALID_STATE", "This session has no questions yet.");

  const transcript = mergeAnswers(stored, answers, now);

  // The slow part (seconds, for a real model) happens before any database write,
  // so no transaction is held open while we wait for the AI.
  const { evaluation, model } = await evaluateSession({
    transcript,
    category: row.category as CategoryKey,
    difficulty: row.difficulty as Difficulty,
  });
  // The model only scores questions. The overall number is computed here.
  const score = overallScore(evaluation.questions.map((question) => question.score));

  try {
    const created = await prisma.$transaction(async (tx) => {
      const claimed = await tx.interview.updateMany({
        where: { id, userId, status: "IN_PROGRESS" },
        data: { status: "COMPLETED", completedAt: now, transcript: toJson(transcript) },
      });
      if (claimed.count === 0) return null; // another request completed it first
      return tx.feedback.create({
        data: { interviewId: id, overallScore: score, evaluation: toJson(evaluation), model },
        select: { id: true, overallScore: true },
      });
    });
    if (created) return { feedbackId: created.id, overallScore: created.overallScore, alreadySubmitted: false };
  } catch (error) {
    if (!isUniqueViolation(error)) throw error; // P2002 on Feedback.interviewId: a concurrent submit won
  }

  const existing = await prisma.feedback.findFirst({
    where: { interviewId: id, interview: { userId } },
    select: { id: true, overallScore: true },
  });
  if (!existing) throw new AppError("CONFLICT", "We could not save this report. Please try again.");
  return { feedbackId: existing.id, overallScore: existing.overallScore, alreadySubmitted: true };
}
