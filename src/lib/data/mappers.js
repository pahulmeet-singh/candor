import { summarizeIntegrity } from "@/lib/integrity/summary";
import { logger } from "@/lib/logger";
import { readinessOf } from "@/lib/scoring";
import { deriveDisplayStatus } from "@/lib/status";
import { evaluationSchema } from "@/lib/validations/feedback";
import { transcriptSchema } from "@/lib/validations/session";

/**
 * The only place Prisma rows become the plain objects the UI and the API return.
 * Each `*_SELECT` object lists exactly the columns a query reads, and each mapper copies fields one
 * by one, so a column that is not listed here (like `passwordHash`) cannot reach a response by accident.
 */

/** The `select` that `toInterviewDTO` reads from. */
export const INTERVIEW_SELECT = {
  id: true,
  category: true,
  difficulty: true,
  mode: true,
  scheduledAt: true,
  durationMin: true,
  status: true,
  startedAt: true,
  completedAt: true,
  resumeId: true,
  createdAt: true,
  feedback: { select: { id: true, overallScore: true } },
};

export function toInterviewDTO(row, now, demo) {
  const status = row.status;
  return {
    id: row.id,
    category: row.category,
    difficulty: row.difficulty,
    mode: row.mode,
    scheduledAt: row.scheduledAt.toISOString(),
    durationMin: row.durationMin,
    status,
    displayStatus: deriveDisplayStatus(
      { status, scheduledAt: row.scheduledAt, durationMin: row.durationMin },
      now,
      demo,
    ),
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    usesResume: row.resumeId !== null,
    feedbackId: row.feedback?.id ?? null,
    overallScore: row.feedback?.overallScore ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

/** JSONB columns are validated on the way out as well as on the way in. */
export function parseTranscript(value, where) {
  if (value === null || value === undefined) return null;
  const parsed = transcriptSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  logger.error("transcript.invalid", { where, issues: parsed.error.issues.slice(0, 3) });
  return null;
}

export function parseEvaluation(value, where) {
  const parsed = evaluationSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  logger.error("evaluation.invalid", { where, issues: parsed.error.issues.slice(0, 3) });
  return null;
}

export function toResumeDTO(row) {
  return {
    id: row.id,
    fileName: row.fileName,
    sizeBytes: row.sizeBytes,
    uploadedAt: row.uploadedAt.toISOString(),
  };
}

export function toFeedbackListItem(row) {
  // The list only needs the one-line summary, so read it without re-validating the whole report.
  const raw = row.evaluation;
  const summary = typeof raw?.summary === "string" ? raw.summary : "";
  return {
    id: row.id,
    interviewId: row.interviewId,
    category: row.interview.category,
    difficulty: row.interview.difficulty,
    overallScore: row.overallScore,
    readiness: readinessOf(row.overallScore),
    summary,
    completedAt: (row.interview.completedAt ?? row.createdAt).toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/** The `select` for integrity events: facts about a moment, never any content. */
export const INTEGRITY_EVENT_SELECT = {
  id: true,
  type: true,
  questionId: true,
  startedAt: true,
  durationMs: true,
  detail: true,
};

/**
 * `detail` is JSONB. The database already refuses anything but a character count in it, but a value
 * read back from a JSON column is `unknown`, so it is checked here instead of trusted.
 */
function toStoredEvent(row) {
  const raw = row.detail;
  const chars = typeof raw?.chars === "number" && Number.isFinite(raw.chars) ? raw.chars : null;
  return {
    id: row.id,
    type: row.type,
    questionId: row.questionId,
    startedAt: row.startedAt.toISOString(),
    durationMs: row.durationMs,
    detail: chars === null ? null : { chars },
  };
}

export function toFeedbackDetail(row) {
  const evaluation = parseEvaluation(row.evaluation, `feedback:${row.id}`);
  const transcript = parseTranscript(row.interview.transcript, `feedback:${row.id}`);
  if (!evaluation || !transcript) return null;

  // A practice interview is never watched, so it has no integrity section at all (not an empty one).
  const integrity =
    row.interview.mode === "ASSESSMENT"
      ? summarizeIntegrity(row.interview.integrityEvents.map(toStoredEvent), {
          sessionStartedAt: row.interview.startedAt?.toISOString() ?? null,
          questionIds: transcript.questions.map((question) => question.id),
        })
      : null;

  return {
    id: row.id,
    interviewId: row.interviewId,
    overallScore: row.overallScore,
    readiness: readinessOf(row.overallScore),
    model: row.model,
    createdAt: row.createdAt.toISOString(),
    evaluation,
    transcript,
    integrity,
    interview: {
      id: row.interview.id,
      category: row.interview.category,
      difficulty: row.interview.difficulty,
      mode: row.interview.mode,
      scheduledAt: row.interview.scheduledAt.toISOString(),
      startedAt: row.interview.startedAt?.toISOString() ?? null,
      completedAt: row.interview.completedAt?.toISOString() ?? null,
      durationMin: row.interview.durationMin,
    },
  };
}
