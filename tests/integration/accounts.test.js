import "./setup";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, beforeEach, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { registerUser } from "@/lib/services/account";
import { setUserRole } from "@/lib/services/admin";
import { codeOf, createUser, rejectsWith, resetDatabase } from "./helpers";

const PASSWORD = "Password123!";
const newEmail = (label) => `${label}-${randomUUID().slice(0, 8)}@integration.test`;

describe("accounts and roles on a real PostgreSQL database", () => {
  // The role rules count admins across the whole table, so every test starts from an empty one.
  beforeEach(resetDatabase);
  after(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("stores a bcrypt hash and never the password", async () => {
    const created = await registerUser({ name: "Asha Rao", email: newEmail("hash"), password: PASSWORD });

    const row = await prisma.user.findUniqueOrThrow({ where: { id: created.id } });
    assert.equal(row.role, "USER");
    assert.match(row.passwordHash ?? "", /^\$2[aby]\$12\$/);
    assert.notEqual(row.passwordHash, PASSWORD);
  });

  it("refuses a second account with the same email and points at the field", async () => {
    const email = newEmail("dup");
    await registerUser({ name: "First Person", email, password: PASSWORD });

    const error = await rejectsWith(registerUser({ name: "Second Person", email, password: PASSWORD }), "CONFLICT");
    assert.ok(error.fieldErrors?.email, "the error should point at the email field");
    assert.equal(await prisma.user.count({ where: { email } }), 1);
  });

  it("lets only one of two simultaneous sign-ups with the same email through", { timeout: 60_000 }, async () => {
    const email = newEmail("simultaneous");

    const results = await Promise.allSettled([
      registerUser({ name: "Tab One", email, password: PASSWORD }),
      registerUser({ name: "Tab Two", email, password: PASSWORD }),
    ]);

    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const failed = results.find((result) => result.status === "rejected");
    assert.equal(codeOf(failed?.reason), "CONFLICT");
    assert.equal(await prisma.user.count({ where: { email } }), 1, "the UNIQUE constraint is the real guard");
  });

  it("does not let an admin change their own role", async () => {
    const admin = await createUser("self", "ADMIN");
    await rejectsWith(setUserRole(admin.id, admin.id, "USER"), "FORBIDDEN");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).role, "ADMIN");
  });

  it("never demotes the last admin", async () => {
    // The actor is not an admin here: this is the stale-token case, where a demoted admin still holds an old session.
    const onlyAdmin = await createUser("only-admin", "ADMIN");
    const staleActor = await createUser("stale-actor");

    await rejectsWith(setUserRole(staleActor.id, onlyAdmin.id, "USER"), "INVALID_STATE");
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: onlyAdmin.id } })).role, "ADMIN");
  });

  it("promotes a user, and demotes them again while another admin remains", async () => {
    const admin = await createUser("boss", "ADMIN");
    const member = await createUser("member");

    const promoted = await setUserRole(admin.id, member.id, "ADMIN");
    assert.deepEqual(promoted, { id: member.id, role: "ADMIN" });

    const demoted = await setUserRole(admin.id, member.id, "USER");
    assert.deepEqual(demoted, { id: member.id, role: "USER" });
    assert.equal(await prisma.user.count({ where: { role: "ADMIN" } }), 1);
  });

  it("cannot be tricked by two admins demoting each other at the same moment", { timeout: 60_000 }, async () => {
    const a = await createUser("admin-a", "ADMIN");
    const b = await createUser("admin-b", "ADMIN");

    const results = await Promise.allSettled([setUserRole(a.id, b.id, "USER"), setUserRole(b.id, a.id, "USER")]);

    // Whichever way the two transactions interleave, the platform keeps an admin and at most one change wins.
    assert.ok((await prisma.user.count({ where: { role: "ADMIN" } })) >= 1, "the platform must keep an admin");
    assert.ok(results.filter((result) => result.status === "fulfilled").length <= 1, "at most one demotion succeeds");
  });
});
