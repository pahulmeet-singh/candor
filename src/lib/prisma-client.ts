/**
 * Builds a PrismaClient on top of the `pg` driver adapter (required by Prisma 7).
 *
 * This file has no `server-only` import on purpose: the seed script runs under
 * plain Node and uses the same factory. The app itself never imports this
 * directly; it goes through `lib/db.ts`, which adds the dev-time singleton.
 */

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/** Query parameters that only Prisma's old query engine understood. node-postgres would pass them on as unknown options. */
const PRISMA_ONLY_PARAMS = ["pgbouncer", "connection_limit", "pool_timeout", "statement_cache_size", "schema", "sslmode"];

export function cleanConnectionString(raw: string): string {
  try {
    const url = new URL(raw);
    for (const key of PRISMA_ONLY_PARAMS) url.searchParams.delete(key);
    return url.toString();
  } catch {
    return raw;
  }
}

export function createPrismaClient(connectionString: string | undefined = process.env.DATABASE_URL): PrismaClient {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env and fill it in (see docs/DEPLOYMENT.md).");
  }

  // Supabase presents a certificate chain that node-postgres cannot verify against the
  // system store, so TLS stays on but is not verified. Set DATABASE_SSL=disable for a local Postgres.
  const ssl = process.env.DATABASE_SSL === "disable" ? false : { rejectUnauthorized: false };

  const adapter = new PrismaPg({
    connectionString: cleanConnectionString(connectionString),
    ssl,
    // Serverless functions each hold their own pool; keep it small so many instances do not exhaust Supavisor.
    max: 5,
  });

  return new PrismaClient({
    adapter,
    log: process.env.PRISMA_LOG === "query" ? ["query", "warn", "error"] : ["warn", "error"],
  });
}
