/**
 * One-line JSON logs. Log platforms (Vercel, Datadog, CloudWatch) can index
 * these without a parsing rule, and a request id ties a failing request to
 * every line it produced. Fields whose names look like secrets are redacted.
 */

type Level = "debug" | "info" | "warn" | "error";

const SECRET_KEY = /pass(word)?|token|secret|authorization|cookie|api[-_]?key|service[-_]?role/i;

function describeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      code: (error as { code?: unknown }).code,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
      cause: error.cause instanceof Error ? error.cause.message : undefined,
    };
  }
  return { message: String(error) };
}

function sanitise(fields: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (SECRET_KEY.test(key)) out[key] = "[redacted]";
    else if (key === "error" || key === "err") out.error = describeError(value);
    else out[key] = value;
  }
  return out;
}

export function log(level: Level, event: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ level, time: new Date().toISOString(), event, ...sanitise(fields) });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (event: string, fields?: Record<string, unknown>) => {
    if (process.env.NODE_ENV !== "production") log("debug", event, fields);
  },
  info: (event: string, fields?: Record<string, unknown>) => log("info", event, fields),
  warn: (event: string, fields?: Record<string, unknown>) => log("warn", event, fields),
  error: (event: string, fields?: Record<string, unknown>) => log("error", event, fields),
};
