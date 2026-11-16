import { test } from "node:test";
import assert from "node:assert/strict";
import nextConfig from "../next.config.mjs";

/** The header rules, in the order Next.js evaluates them. */
async function rules() {
  assert.ok(nextConfig.headers, "next.config.mjs must define headers()");
  return nextConfig.headers();
}

const policyOf = (rule) => rule.headers.find((header) => header.key === "Permissions-Policy")?.value;

test("every page denies the camera, microphone and location by default", async () => {
  const [everything] = await rules();
  assert.ok(everything);
  assert.equal(everything.source, "/:path*");
  assert.equal(policyOf(everything), "camera=(), microphone=(), geolocation=()");
});

test("only the interview room may use the camera, and only for its own origin", async () => {
  const all = await rules();
  const allowing = all.filter((rule) => policyOf(rule)?.includes("camera=(self)"));
  assert.deepEqual(
    allowing.map((rule) => rule.source),
    ["/interviews/:id/session"],
  );
  assert.equal(policyOf(allowing[0]), "camera=(self), microphone=(), geolocation=()");
});

test("the room's rule comes after the global one, because for the same header the later rule wins", async () => {
  const sources = (await rules()).map((rule) => rule.source);
  assert.ok(sources.indexOf("/interviews/:id/session") > sources.indexOf("/:path*"));
});

test("the other security headers are still sent on every page", async () => {
  const [everything] = await rules();
  assert.ok(everything);
  assert.deepEqual(Object.fromEntries(everything.headers.map((header) => [header.key, header.value])), {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  });
});
