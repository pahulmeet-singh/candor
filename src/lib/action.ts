import "server-only";
import { unstable_rethrow } from "next/navigation";
import { isAppError, publicMessage, type ErrorCode, type FieldErrors } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { ActionResult } from "@/lib/types";

/**
 * Wraps the body of a Server Action so it always returns an `ActionResult`
 * instead of throwing. Forms render `result.error` and `result.fieldErrors`
 * with no try/catch of their own.
 *
 * `redirect()` and `notFound()` work by throwing; `unstable_rethrow` lets those
 * (and Next's other control-flow errors) pass through untouched.
 */
export async function runAction<T>(
  name: string,
  body: () => Promise<{ data: T; message?: string }>,
): Promise<ActionResult<T>> {
  try {
    const { data, message } = await body();
    return { ok: true, data, message };
  } catch (error) {
    unstable_rethrow(error);
    return failure(name, error);
  }
}

export function failure(name: string, error: unknown): { ok: false; error: string; code?: ErrorCode; fieldErrors?: FieldErrors } {
  if (isAppError(error)) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
  logger.error("action.unhandled", { name, error });
  return { ok: false, error: publicMessage(error), code: "INTERNAL" };
}
