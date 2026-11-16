import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { INTEGRITY_EVENT_TYPES, INTERVIEW_MODES } from "@/lib/integrity/constants";

/**
 * The browser, the server and the database each need the list of event types and interview modes.
 * They are written down in three places (src/lib/integrity/constants.js, prisma/schema.prisma and the
 * SQL migrations), so this test reads all three and fails the moment one is changed without the
 * others. It also pins the privacy promise: the event table holds facts about a session, never text.
 *
 * Tests run from the project root (npm scripts), so paths are relative to process.cwd().
 */

const root = process.cwd();
const schema = readFileSync(path.join(root, "prisma/schema.prisma"), "utf8");

const migrationsDir = path.join(root, "prisma/migrations");
const migrationNames = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();
const sql = migrationNames
  .map((name) => readFileSync(path.join(migrationsDir, name, "migration.sql"), "utf8"))
  .join("\n");

/** The values of `enum <name> { ... }` in schema.prisma, in order. */
function prismaEnum(name) {
  const match = new RegExp(`^enum ${name} \\{([^}]*)\\}`, "m").exec(schema);
  assert.ok(match, `enum ${name} is missing from schema.prisma`);
  return (match[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//"));
}

/** The values of a Postgres enum after every migration: CREATE TYPE, then any ALTER TYPE ... ADD VALUE. */
function sqlEnum(name) {
  const create = new RegExp(`CREATE TYPE "${name}" AS ENUM \\(([^)]*)\\)`).exec(sql);
  assert.ok(create, `no migration creates the enum ${name}`);
  const values = [...(create[1] ?? "").matchAll(/'([^']+)'/g)].map((found) => found[1] ?? "");
  for (const added of sql.matchAll(new RegExp(`ALTER TYPE "${name}" ADD VALUE(?: IF NOT EXISTS)? '([^']+)'`, "g"))) {
    values.push(added[1] ?? "");
  }
  return values;
}

/** The lines of `model <name> { ... }` that declare a field, as [fieldName, ...]. */
function prismaFieldNames(model) {
  const match = new RegExp(`^model ${model} \\{([\\s\\S]*?)^\\}`, "m").exec(schema);
  assert.ok(match, `model ${model} is missing from schema.prisma`);
  return (match[1] ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "" && !line.startsWith("//") && !line.startsWith("@@"))
    .map((line) => line.split(/\s+/)[0] ?? "");
}

test("INTERVIEW_MODES matches the Prisma enum and the Postgres enum", () => {
  assert.deepEqual(prismaEnum("InterviewMode"), [...INTERVIEW_MODES]);
  assert.deepEqual(sqlEnum("InterviewMode"), [...INTERVIEW_MODES]);
});

test("INTEGRITY_EVENT_TYPES matches the Prisma enum and the Postgres enum", () => {
  assert.deepEqual(prismaEnum("IntegrityEventType"), [...INTEGRITY_EVENT_TYPES]);
  assert.deepEqual(sqlEnum("IntegrityEventType"), [...INTEGRITY_EVENT_TYPES]);
});

test("monitoring is opt-in: an interview is PRACTICE unless ASSESSMENT is chosen", () => {
  assert.match(schema, /^\s*mode\s+InterviewMode\s+@default\(PRACTICE\)/m);
  assert.match(sql, /"mode" "InterviewMode" NOT NULL DEFAULT 'PRACTICE'/);
});

test("the integrity event table keeps facts about a session and has no column for text or media", () => {
  assert.deepEqual(prismaFieldNames("IntegrityEvent"), [
    "id",
    "interviewId",
    "type",
    "questionId",
    "startedAt",
    "durationMs",
    "detail",
    "createdAt",
    "interview",
  ]);
  // `detail` is the only free-form column, and the database refuses anything but a character count in it.
  assert.match(sql, /"IntegrityEvent_detail_only_chars_check"/);
});

test("the hand-written CHECK constraints are still in the migrations", () => {
  // Prisma cannot express CHECK constraints, so a regenerated migration would silently drop them.
  for (const name of [
    "Interview_assessment_requires_consent_check",
    "IntegrityEvent_durationMs_check",
    "IntegrityEvent_detail_only_chars_check",
  ]) {
    assert.ok(sql.includes(`CONSTRAINT "${name}"`) || sql.includes(`ADD CONSTRAINT "${name}"`), `${name} is missing`);
  }
});

test("events are deleted together with their interview", () => {
  const model = /^model IntegrityEvent \{[\s\S]*?^\}/m.exec(schema)?.[0] ?? "";
  assert.match(
    model,
    /interview\s+Interview\s+@relation\(fields: \[interviewId\], references: \[id\], onDelete: Cascade\)/,
  );
  assert.match(
    sql,
    /"IntegrityEvent_interviewId_fkey" FOREIGN KEY \("interviewId"\) REFERENCES "Interview"\("id"\) ON DELETE CASCADE/,
  );
});

test("migrations are listed in time order, with the integrity migration after the first one", () => {
  assert.equal(migrationNames[0], "20261029000000_init");
  assert.ok(migrationNames.includes("20261112000000_integrity_monitoring"));
  assert.deepEqual(migrationNames, [...migrationNames].sort());
});
