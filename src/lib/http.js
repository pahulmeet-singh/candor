import "server-only";
import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { NextResponse } from "next/server";
import { AppError, isAppError, publicMessage } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Helpers shared by every Route Handler: one error envelope, one place that
 * turns exceptions into responses, and request ids that tie a response to its log lines.
 */

export function errorResponse(error, requestId) {
  if (isAppError(error)) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, fieldErrors: error.fieldErrors, requestId } },
      { status: error.status },
    );
  }
  logger.error("api.unhandled", { error, requestId });
  return NextResponse.json({ error: { code: "INTERNAL", message: publicMessage(error), requestId } }, { status: 500 });
}

const MAX_BODY_CHARS = 1_000_000;

/** Parse a JSON body, turning malformed or oversized input into a 422 instead of a crash. */
export async function readJson(request) {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) throw new AppError("VALIDATION", "The request body is too large.");
  if (text.trim() === "") return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION", "The request body must be valid JSON.");
  }
}

/** Like `readJson`, but the body must be a JSON object (not an array, string or null). */
export async function readJsonObject(request) {
  const body = await readJson(request);
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError("VALIDATION", "The request body must be a JSON object.");
  }
  return body;
}

/** Responses that depend on who is signed in must never be stored by a shared cache. */
export const NO_STORE = { "Cache-Control": "private, no-store" };

/**
 * Cookie-authenticated routes that change data must come from our own pages.
 * SameSite=Lax cookies already block most cross-site POSTs; this is the second lock.
 */
function assertSameOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return; // same-origin fetches from older browsers and non-browser clients omit it
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  let originHost;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Cross-site requests are not allowed.");
  }
  if (host && originHost !== host) throw new AppError("FORBIDDEN", "Cross-site requests are not allowed.");
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function requestIdOf(request) {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

async function execute(name, request, run) {
  const requestId = requestIdOf(request);
  const started = performance.now();
  try {
    if (!SAFE_METHODS.has(request.method)) assertSameOrigin(request);
    const response = await run(requestId);
    response.headers.set("x-request-id", requestId);
    logger.debug("api.ok", {
      name,
      method: request.method,
      status: response.status,
      ms: Math.round(performance.now() - started),
      requestId,
    });
    return response;
  } catch (error) {
    unstable_rethrow(error);
    const response = errorResponse(error, requestId);
    response.headers.set("x-request-id", requestId);
    logger.debug("api.failed", {
      name,
      method: request.method,
      status: response.status,
      ms: Math.round(performance.now() - started),
      requestId,
    });
    return response;
  }
}

/** Wrap a Route Handler that has no dynamic segments. */
export function withApi(name, handler) {
  return (request) => execute(name, request, (requestId) => handler(request, { requestId }));
}

/** Wrap a Route Handler with dynamic segments. Next 16 passes `params` as a Promise. */
export function withApiParams(name, handler) {
  return (request, context) =>
    execute(name, request, async (requestId) => handler(request, await context.params, { requestId }));
}

/** Best-effort client address for rate limiting. Never trust it for authorisation. */
export async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
