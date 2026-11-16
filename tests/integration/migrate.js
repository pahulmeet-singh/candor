/**
 * `npm run test:db:migrate`: applies the committed migrations to the TEST database.
 *
 * It runs the normal `prisma migrate deploy`, but hands it TEST_DATABASE_URL as both connection
 * strings. dotenv never overrides variables that are already set, so a `.env` that points at
 * Supabase cannot win. The same guard as the tests refuses anything that is not a local test database.
 */
import "dotenv/config"; // lets TEST_DATABASE_URL live in .env
import { spawnSync } from "node:child_process";
import { safeTestDatabaseUrl } from "./guard";

try {
  const url = safeTestDatabaseUrl(process.env.TEST_DATABASE_URL);

  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    stdio: "inherit",
    shell: process.platform === "win32", // npx is npx.cmd on Windows
    env: { ...process.env, DATABASE_URL: url, DIRECT_URL: url },
  });

  if (result.error) throw result.error;
  process.exit(result.status ?? 1);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
