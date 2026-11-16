import "dotenv/config"; // lets TEST_DATABASE_URL live in .env
import { defineConfig, devices } from "@playwright/test";
import { safeTestDatabaseUrl } from "./tests/integration/guard";

/**
 * Browser tests (`npm run test:e2e`).
 *
 * They drive a real Chromium against a production build (`next build`, then `next start`), the way the
 * app runs on Vercel. Two switches make that build deterministic and fast to test:
 *   AI_MODE=mock    the offline question bank and rubric evaluator, so there is no network and no key
 *   DEMO_MODE=true  a booked interview may be started at once instead of at its slot time
 * The tests create their own users in the TEST database. One-time setup is in docs/TESTING.md.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100); // not 3000, so a running `npm run dev` is left alone
const BASE_URL = `http://localhost:${PORT}`;
const databaseUrl = safeTestDatabaseUrl(process.env.TEST_DATABASE_URL);

export default defineConfig({
  testDir: "./e2e",
  // One worker: all tests share one database, and a slot has only three seats.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Set E2E_SKIP_BUILD=1 to reuse the last build while you iterate on a test.
    command: process.env.E2E_SKIP_BUILD ? "npm run start" : "npm run build && npm run start",
    url: `${BASE_URL}/api/health`,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      PORT: String(PORT),
      DATABASE_URL: databaseUrl,
      DIRECT_URL: databaseUrl,
      DATABASE_SSL: "disable",
      AUTH_SECRET: "e2e-only-secret-used-by-nothing-else-0123456789abcdef",
      AUTH_URL: BASE_URL,
      NEXT_PUBLIC_APP_URL: BASE_URL,
      AI_MODE: "mock",
      DEMO_MODE: "true",
      // Every test signs up its own user from the same address, which the real rate limits would block.
      DISABLE_RATE_LIMITS: "true",
      // Empty values stop a developer's .env from leaking real keys into the test server.
      GEMINI_API_KEY: "",
      SUPABASE_URL: "",
      SUPABASE_SERVICE_ROLE_KEY: "",
      AUTH_GOOGLE_ID: "",
      AUTH_GOOGLE_SECRET: "",
    },
  },
});
