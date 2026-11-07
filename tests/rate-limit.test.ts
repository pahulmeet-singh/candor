import { beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { isAppError } from "@/lib/errors";
import { assertWithinRate, rateLimit, resetRateLimits } from "@/lib/rate-limit";

beforeEach(() => resetRateLimits());

test("allows up to the limit and then reports how long to wait", () => {
  assert.deepEqual(rateLimit("login:a", 3, 60_000, 1_000), { ok: true, remaining: 2 });
  assert.deepEqual(rateLimit("login:a", 3, 60_000, 2_000), { ok: true, remaining: 1 });
  assert.deepEqual(rateLimit("login:a", 3, 60_000, 3_000), { ok: true, remaining: 0 });

  const blocked = rateLimit("login:a", 3, 60_000, 4_000);
  assert.equal(blocked.ok, false);
  // The oldest hit (t=1s) leaves the window at t=61s, so 57 seconds from t=4s.
  if (!blocked.ok) assert.equal(blocked.retryAfterSeconds, 57);
});

test("the window slides: old hits stop counting", () => {
  rateLimit("k", 1, 10_000, 0);
  assert.equal(rateLimit("k", 1, 10_000, 5_000).ok, false);
  assert.equal(rateLimit("k", 1, 10_000, 10_001).ok, true);
});

test("a blocked attempt is not recorded, so waiting out the window really resets it", () => {
  rateLimit("k", 1, 10_000, 0);
  for (let t = 1_000; t < 9_000; t += 1_000) assert.equal(rateLimit("k", 1, 10_000, t).ok, false);
  assert.equal(rateLimit("k", 1, 10_000, 10_001).ok, true);
});

test("keys are independent", () => {
  rateLimit("login:a", 1, 60_000, 0);
  assert.equal(rateLimit("login:a", 1, 60_000, 1).ok, false);
  assert.equal(rateLimit("login:b", 1, 60_000, 1).ok, true);
});

test("assertWithinRate throws an AppError that maps to HTTP 429", () => {
  assertWithinRate("act:1", 1, 60_000);
  assert.throws(
    () => assertWithinRate("act:1", 1, 60_000),
    (error: unknown) => isAppError(error) && error.code === "RATE_LIMITED" && error.status === 429 && /try again in/i.test(error.message),
  );
});
