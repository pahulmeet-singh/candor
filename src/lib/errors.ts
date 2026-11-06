/**
 * One error type for the whole server side.
 *
 * Services throw `AppError` with a stable `code`; the two entry points
 * (Server Actions and Route Handlers) translate it into either an
 * `ActionResult` or an HTTP response. Nothing else needs to know about HTTP.
 */

export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "SLOT_FULL"
  | "SLOT_INVALID"
  | "LIMIT_REACHED"
  | "INVALID_STATE"
  | "RATE_LIMITED"
  | "FILE_INVALID"
  | "STORAGE_ERROR"
  | "AI_UNAVAILABLE"
  | "AI_RATE_LIMITED"
  | "AI_BAD_OUTPUT"
  | "INTERNAL";

export const ERROR_STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION: 422,
  CONFLICT: 409,
  SLOT_FULL: 409,
  SLOT_INVALID: 422,
  LIMIT_REACHED: 409,
  INVALID_STATE: 409,
  RATE_LIMITED: 429,
  FILE_INVALID: 422,
  STORAGE_ERROR: 502,
  AI_UNAVAILABLE: 503,
  AI_RATE_LIMITED: 429,
  AI_BAD_OUTPUT: 502,
  INTERNAL: 500,
};

export type FieldErrors = Record<string, string[]>;

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly fieldErrors?: FieldErrors;

  constructor(code: ErrorCode, message: string, options?: { fieldErrors?: FieldErrors; cause?: unknown }) {
    super(message, options?.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.fieldErrors = options?.fieldErrors;
  }

  get status(): number {
    return ERROR_STATUS[this.code];
  }
}

/**
 * Duck-typed on purpose. Server Actions, Route Handlers and Server Components
 * can be compiled into separate module graphs, so `instanceof AppError` is not
 * reliable across them.
 */
export function isAppError(value: unknown): value is AppError {
  if (!(value instanceof Error) || value.name !== "AppError") return false;
  const code = (value as { code?: unknown }).code;
  return typeof code === "string" && code in ERROR_STATUS;
}

/** Text that is safe to show to a user for any thrown value. */
export function publicMessage(error: unknown): string {
  if (isAppError(error)) return error.message;
  return "Something went wrong on our side. Please try again.";
}
