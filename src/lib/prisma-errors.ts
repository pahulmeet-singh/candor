/**
 * Prisma reports failures as errors with a `code` such as "P2002". They are
 * recognised by shape instead of `instanceof` because the generated client can
 * be bundled separately for Server Actions, Route Handlers and pages, and a
 * class check across bundles silently fails.
 */

export function prismaCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/** P2002: a unique constraint was violated (for example a duplicate email). */
export function isUniqueViolation(error: unknown): boolean {
  return prismaCode(error) === "P2002";
}

/**
 * P2034: the database aborted a transaction because of a write conflict or a
 * deadlock. With SERIALIZABLE isolation this is the normal way two bookings
 * for the last seat lose a race, and retrying is the correct response.
 * Driver adapters sometimes surface the raw Postgres code (40001/40P01) instead.
 */
export function isSerializationFailure(error: unknown): boolean {
  const code = prismaCode(error);
  if (code === "P2034" || code === "40001" || code === "40P01") return true;
  const message = error instanceof Error ? error.message : "";
  return /could not serialize access|serialization failure|deadlock detected|write conflict/i.test(message);
}
