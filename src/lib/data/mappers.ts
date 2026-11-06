import type { CategoryKey } from "@/lib/constants/categories";
import type { Difficulty } from "@/lib/constants/difficulty";
import { logger } from "@/lib/logger";
import { readinessOf } from "@/lib/scoring";
import { deriveDisplayStatus } from "@/lib/status";
import type {
  FeedbackDetailDTO,
  FeedbackListItemDTO,
  InterviewDTO,
  InterviewStatus,
  ResumeDTO,
} from "@/lib/types";
import { evaluationSchema, type Evaluation } from "@/lib/validations/feedback";
import { transcriptSchema, type Transcript } from "@/lib/validations/session";

/**
 * The only place Prisma rows become the plain objects the UI and the API return.
 * Each `*Row` interface lists exactly the columns a query selects, so a column
 * that is not listed here (like `passwordHash`) cannot reach a response by accident.
 */

export interface InterviewRow {
  id: string;
  category: string;
  difficulty: string;
  scheduledAt: Date;
  durationMin: number;
  status: string;
  startedAt: Date | null;
  completedAt: Date | null;
  resumeId: string | null;
  createdAt: Date;
  feedback: { id: string; overallScore: number } | null;
}

/** The `select` that produces an `InterviewRow`. */
export const INTERVIEW_SELECT = {
  id: true,
  category: true,
  difficulty: true,
  scheduledAt: true,
  durationMin: true,
  status: true,
  startedAt: true,
  completedAt: true,
  resumeId: true,
  createdAt: true,
  feedback: { select: { id: true, overallScore: true } },
} as const;

export function toInterviewDTO(row: InterviewRow, now: Date, demo: boolean): InterviewDTO {
  const status = row.status as InterviewStatus;
  return {
    id: row.id,
    category: row.category as CategoryKey,
    difficulty: row.difficulty as Difficulty,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMin: row.durationMin,
    status,
    displayStatus: deriveDisplayStatus({ status, scheduledAt: row.scheduledAt, durationMin: row.durationMin }, now, demo),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    usesResume: row.resumeId !== null,
    feedbackId: row.feedback?.id ?? null,
    overallScore: row.feedback?.overallScore ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** JSONB columns are validated on the way out as well as on the way in. */
export function parseTranscript(value: unknown, where: string): Transcript | null {
  if (value === null || value === undefined) return null;
  const parsed = transcriptSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  logger.error("transcript.invalid", { where, issues: parsed.error.issues.slice(0, 3) });
  return null;
}

export function parseEvaluation(value: unknown, where: string): Evaluation | null {
  const parsed = evaluationSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  logger.error("evaluation.invalid", { where, issues: parsed.error.issues.slice(0, 3) });
  return null;
}

export function toResumeDTO(row: { id: string; fileName: string; sizeBytes: number; uploadedAt: Date }): ResumeDTO {
  return {
    id: row.id,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export interface FeedbackListRow {
  id: string;
  interviewId: string;
  overallScore: number;
  createdAt: Date;
  evaluation: unknown;
  interview: { category: string; difficulty: string; completedAt: Date | null };
}

export function toFeedbackListItem(row: FeedbackListRow): FeedbackListItemDTO {
  // The list only needs the one-line summary, so read it without re-validating the whole report.
  const raw = row.evaluation as { summary?: unknown } | null;
  const summary = typeof raw?.summary === "string" ? raw.summary : "";
  return {
    id: row.id,
    interviewId: row.interviewId,
    category: row.interview.category as CategoryKey,
    difficulty: row.interview.difficulty as Difficulty,
    overallScore: row.overallScore,
    readiness: readinessOf(row.overallScore),
    summary,
    completedAt: (row.interview.completedAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

export interface FeedbackDetailRow {
  id: string;
  interviewId: string;
  overallScore: number;
  model: string;
  createdAt: Date;
  evaluation: unknown;
  interview: {
    id: string;
    category: string;
    difficulty: string;
    scheduledAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    durationMin: number;
    transcript: unknown;
  };
}

export function toFeedbackDetail(row: FeedbackDetailRow): FeedbackDetailDTO | null {
  const evaluation = parseEvaluation(row.evaluation, `feedback:${row.id}`);
  const transcript = parseTranscript(row.interview.transcript, `feedback:${row.id}`);
  if (!evaluation || !transcript) return null;
  return {
    id: row.id,
    interviewId: row.interviewId,
    overallScore: row.overallScore,
    readiness: readinessOf(row.overallScore),
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    evaluation,
    transcript,
    interview: {
      id: row.interview.id,
      category: row.interview.category as CategoryKey,
      difficulty: row.interview.difficulty as Difficulty,
      scheduledAt: row.interview.scheduledAt.toISOString(),
      startedAt: row.interview.startedAt?.toISOString() ?? null,
      completedAt: row.interview.completedAt?.toISOString() ?? null,
      durationMin: row.interview.durationMin,
    },
  };
}
