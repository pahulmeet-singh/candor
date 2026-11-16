/**
 * Safety guard for the database tests.
 *
 * The integration suite empties tables, so it must never run against a real database by accident.
 * `DATABASE_URL` in `.env` normally points at Supabase, so the suite ignores that variable
 * completely. It only reads `TEST_DATABASE_URL`, and only accepts it when the URL looks disposable:
 *
 *   1. a local host (localhost, 127.0.0.1 or ::1), and
 *   2. a database name that contains "test", such as `candor_test`.
 *
 * Anything else throws before a single connection is opened. The function is pure on purpose,
 * so `tests/test-database-guard.test.js` can check every refusal without a database.
 */

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export class UnsafeTestDatabaseError extends Error {
  constructor(message) {
    super(message);
    this.name = "UnsafeTestDatabaseError";
  }
}

/** Returns the URL unchanged when it is safe to wipe, and throws `UnsafeTestDatabaseError` otherwise. */
export function safeTestDatabaseUrl(raw) {
  const value = raw?.trim();
  if (!value) {
    throw new UnsafeTestDatabaseError(
      "TEST_DATABASE_URL is not set. Point it at a throwaway local database, for example " +
        "postgresql://candor:candor@localhost:5432/candor_test (see docs/TESTING.md).",
    );
  }

  let url;
  try {
    url = new URL(value);
  } catch {
    throw new UnsafeTestDatabaseError("TEST_DATABASE_URL is not a valid URL.");
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new UnsafeTestDatabaseError(
      `TEST_DATABASE_URL must start with postgresql:// (it starts with "${url.protocol}//").`,
    );
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!/test/i.test(database)) {
    throw new UnsafeTestDatabaseError(
      `The database name "${database}" does not contain "test". The suite empties its tables, ` +
        "so it only runs against a database named like candor_test.",
    );
  }

  if (!LOCAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new UnsafeTestDatabaseError(
      `The host "${url.hostname}" is not local. The suite only runs against localhost, 127.0.0.1 or ::1, ` +
        "never against a shared or hosted database.",
    );
  }

  return value;
}
