import { test } from "node:test";
import assert from "node:assert/strict";
import { UnsafeTestDatabaseError, safeTestDatabaseUrl } from "./integration/guard";

/** Asserts the guard refuses `value` with a message that matches `reason`. */
function refuses(value, reason) {
  assert.throws(
    () => safeTestDatabaseUrl(value),
    (error) => error instanceof UnsafeTestDatabaseError && reason.test(error.message),
  );
}

test("accepts a local database whose name contains 'test'", () => {
  const accepted = [
    "postgresql://candor:candor@localhost:5432/candor_test",
    "postgres://user:pw@127.0.0.1/my_test_db?sslmode=disable",
    "postgresql://user:pw@[::1]:5432/app_TEST",
  ];
  for (const url of accepted) assert.equal(safeTestDatabaseUrl(url), url);
});

test("returns the URL trimmed but otherwise untouched", () => {
  const url = "postgresql://candor:p%40ss@localhost:5432/candor_test";
  assert.equal(safeTestDatabaseUrl(`  ${url}\n`), url);
});

test("refuses when TEST_DATABASE_URL is missing or blank", () => {
  for (const value of [undefined, "", "   "]) refuses(value, /TEST_DATABASE_URL is not set/);
});

test("refuses something that is not a URL", () => {
  refuses("not a url", /not a valid URL/);
});

test("refuses other protocols", () => {
  refuses("mysql://user:pw@localhost:3306/candor_test", /must start with postgresql/);
});

test("refuses a database whose name does not contain 'test'", () => {
  refuses("postgresql://user:pw@localhost:5432/postgres", /does not contain "test"/);
  refuses("postgresql://user:pw@localhost:5432/candor", /does not contain "test"/);
});

test("refuses a hosted database even when its name says test", () => {
  refuses("postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:6543/candor_test", /is not local/);
  refuses("postgresql://user:pw@db.internal.example.com:5432/candor_test", /is not local/);
});

test("the usual Supabase connection string is refused on the database name first", () => {
  refuses("postgresql://postgres.abc:pw@aws-0-ap-south-1.pooler.supabase.com:6543/postgres", /does not contain "test"/);
});
