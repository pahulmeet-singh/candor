import type { Prisma } from "@/generated/prisma/client";

/**
 * Prisma wants `InputJsonValue` for JSONB writes, and TypeScript objects with
 * optional keys do not satisfy its index signature. Everything we store has
 * already been through a Zod schema, so the cast is a statement of fact, not a
 * shortcut: `transcriptSchema` and `evaluationSchema` are the real type check.
 */
export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
