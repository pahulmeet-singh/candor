/**
 * A sliding-window rate limiter held in memory.
 *
 * It is deliberately small and honest about its limits: each server instance
 * keeps its own counters, so on a serverless platform the real limit is
 * "per warm instance". That is enough to slow password guessing and runaway AI
 * calls from one client; a shared store (Redis) would be the next step, and is
 * listed in docs/ARCHITECTURE.md.
 */

import { AppError } from "@/lib/errors";

const windows = new Map();
const SWEEP_AT = 5_000;

/**
 * The browser tests (e2e/) create a dozen accounts from one address within minutes, which the real
 * limits (for example six sign-ups an hour) would block. Their Playwright config sets
 * DISABLE_RATE_LIMITS=true for the test server only. Nothing else sets it: not .env.example,
 * not the Vercel guide, not docker-compose. Read at call time so a unit test can flip it.
 */
const limitsDisabled = () => process.env.DISABLE_RATE_LIMITS === "true";

export function rateLimit(key, limit, windowMs, now = Date.now()) {
  if (limitsDisabled()) return { ok: true, remaining: limit };

  const cutoff = now - windowMs;
  const hits = (windows.get(key) ?? []).filter((t) => t > cutoff);

  if (hits.length >= limit) {
    windows.set(key, hits);
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((hits[0] + windowMs - now) / 1000)) };
  }

  hits.push(now);
  windows.set(key, hits);

  if (windows.size > SWEEP_AT) {
    for (const [k, list] of windows) {
      if (list.length === 0 || list[list.length - 1] <= cutoff) windows.delete(k);
    }
  }
  return { ok: true, remaining: limit - hits.length };
}

/**
 * Throws `AppError("RATE_LIMITED")` when the caller is over the limit. This is
 * the form Server Actions and Route Handlers use; `rateLimit` stays available
 * for code that wants to branch on the result.
 */
export function assertWithinRate(key, limit, windowMs) {
  const result = rateLimit(key, limit, windowMs);
  if (result.ok) return;
  const wait = result.retryAfterSeconds;
  const text = wait >= 90 ? `${Math.ceil(wait / 60)} minutes` : `${wait} seconds`;
  throw new AppError("RATE_LIMITED", `Too many attempts. Please try again in ${text}.`);
}

/** Test helper. */
export function resetRateLimits() {
  windows.clear();
}
