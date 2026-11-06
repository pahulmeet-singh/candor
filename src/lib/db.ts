import "server-only";
import type { PrismaClient } from "@/generated/prisma/client";
import { createPrismaClient } from "@/lib/prisma-client";

/**
 * The shared Prisma client.
 *
 * Two details worth knowing:
 *  - In development Next.js re-evaluates modules on every edit. Keeping the
 *    client on `globalThis` stops each reload from opening a new connection pool.
 *  - The client is created on first use, not on import. That keeps `next build`
 *    working on a machine with no database configured, as long as no page needs
 *    data at build time.
 */

const globalForPrisma = globalThis as unknown as { __candorPrisma?: PrismaClient };

function client(): PrismaClient {
  if (!globalForPrisma.__candorPrisma) globalForPrisma.__candorPrisma = createPrismaClient();
  return globalForPrisma.__candorPrisma;
}

export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = client();
    const value = Reflect.get(instance, property) as unknown;
    return typeof value === "function" ? (value as (...args: unknown[]) => unknown).bind(instance) : value;
  },
});
