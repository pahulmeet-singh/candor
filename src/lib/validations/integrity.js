import { z } from "zod";
import { INTEGRITY_EVENT_TYPES, INTEGRITY_RULES } from "@/lib/integrity/constants";

/**
 * What the browser may send to POST /api/interviews/:id/integrity. The browser is not trusted: it can
 * be edited, so the server accepts only these small, well-formed facts and never any free text,
 * image or video. `strictObject` rejects unknown keys instead of silently ignoring them.
 */
export const integrityEventSchema = z.strictObject({
  type: z.enum(INTEGRITY_EVENT_TYPES),
  /** Epoch milliseconds, from the browser's clock. The service checks it against the session. */
  startedAtMs: z.number().int().positive(),
  durationMs: z.number().int().min(0).max(INTEGRITY_RULES.maxSpanMs),
  /** Same limits as a question id in the transcript (transcriptQuestionSchema). */
  questionId: z.string().min(1).max(32).nullable(),
  detail: z.strictObject({ chars: z.number().int().min(0).max(1_000_000) }).optional(),
});

export const integrityBatchSchema = z.strictObject({
  /**
   * The browser's own clock (epoch ms) at the moment it sent the batch. The server compares it with
   * its clock to line the events up, so a laptop with the wrong time still reports correctly.
   */
  sentAtMs: z.number().int().positive(),
  events: z.array(integrityEventSchema).min(1).max(INTEGRITY_RULES.maxEventsPerRequest),
});
