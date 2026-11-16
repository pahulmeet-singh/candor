import "server-only";
import { unstable_rethrow } from "next/navigation";
import { isAppError, publicMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Wraps the body of a Server Action so it always returns an `ActionResult`
 * instead of throwing. Forms render `result.error` and `result.fieldErrors`
 * with no try/catch of their own.
 *
 * `redirect()` and `notFound()` work by throwing; `unstable_rethrow` lets those
 * (and Next's other control-flow errors) pass through untouched.
 */
export async function runAction(name, body) {
  try {
    const { data, message } = await body();
    return { ok: true, data, message };
  } catch (error) {
    unstable_rethrow(error);
    return failure(name, error);
  }
}

export function failure(name, error) {
  if (isAppError(error)) {
    return { ok: false, error: error.message, code: error.code, fieldErrors: error.fieldErrors };
  }
  logger.error("action.unhandled", { name, error });
  return { ok: false, error: publicMessage(error), code: "INTERNAL" };
}
