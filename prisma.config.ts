import "dotenv/config";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 reads connection details from here, not from schema.prisma.
 *
 * `DIRECT_URL` (Supabase "session" pooler, port 5432) is used for migrations
 * because the transaction pooler on 6543 cannot run DDL safely. The running app
 * uses `DATABASE_URL` instead, through a driver adapter.
 *
 * The values are read with a fallback instead of `env("...")` so that
 * `prisma generate` (which runs on `npm install`, before `.env` exists) never
 * fails because a connection string is missing. Commands that really need a
 * database will fail with a clear connection error instead.
 */
const url =
  process.env.DIRECT_URL ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
