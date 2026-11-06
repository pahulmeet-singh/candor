import { z } from "zod";
import { CATEGORY_KEYS } from "@/lib/constants/categories";
import { DIFFICULTIES } from "@/lib/constants/difficulty";
import { AppError, type FieldErrors } from "@/lib/errors";

/** Prisma `cuid()` ids and Auth.js ids are URL-safe strings. */
export const idSchema = z
  .string()
  .min(8, "Invalid id")
  .max(64, "Invalid id")
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid id");

export const categorySchema = z.enum(CATEGORY_KEYS);
export const difficultySchema = z.enum(DIFFICULTIES);

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, "That email address is too long")
  .pipe(z.email("Enter a valid email address"));

/** `{ field: ["message", ...] }`, the shape forms render next to each input. */
export function fieldErrorsOf(error: z.ZodError): FieldErrors {
  const flat = z.flattenError(error).fieldErrors as Record<string, string[] | undefined>;
  const out: FieldErrors = {};
  for (const [key, messages] of Object.entries(flat)) {
    if (messages && messages.length > 0) out[key] = messages;
  }
  return out;
}

/** The first error message in a ZodError, for single-line toasts. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message ?? "Invalid input";
}

/** FormData -> plain object. Repeated keys are not needed by any form in this app. */
export function formDataToObject(formData: FormData): Record<string, FormDataEntryValue> {
  const out: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("$ACTION")) out[key] = value;
  }
  return out;
}

/** Text fields that tolerate an over-long model reply by trimming instead of failing. */
export function clippedText(max: number) {
  return z
    .string()
    .trim()
    .min(1)
    .transform((s) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s));
}

/**
 * Parse untrusted input or throw an `AppError("VALIDATION")` carrying per-field
 * messages. Every Server Action and Route Handler goes through this, so the
 * wire format of a validation failure is the same everywhere.
 */
export function parseInput<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) return result.data;
  throw new AppError("VALIDATION", firstIssue(result.error), { fieldErrors: fieldErrorsOf(result.error) });
}
