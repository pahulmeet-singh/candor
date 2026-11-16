/**
 * Import this FIRST in every integration test file (`import "./setup";`).
 *
 * It points the application at the test database before any service touches Prisma. Nothing is
 * exported on purpose: the helpers live in `helpers.js`, and this file only has to run once per process.
 *
 * `lib/db.js` creates the Prisma client lazily, on first use, and `lib/env.js` reads variables when
 * they are used, so setting `process.env` here is early enough. The safety rules are in `guard.js`.
 */
import "dotenv/config"; // lets TEST_DATABASE_URL live in .env; the lines below still override everything else
import { safeTestDatabaseUrl } from "./guard";

const url = safeTestDatabaseUrl(process.env.TEST_DATABASE_URL);

process.env.DATABASE_URL = url;
process.env.DIRECT_URL = url;
process.env.DATABASE_SSL = "disable"; // a local Postgres has no TLS
process.env.AI_MODE = "mock"; // no network calls, and the same report every time
delete process.env.GEMINI_API_KEY;
delete process.env.DEMO_MODE; // the real rules: a room opens near its slot time
