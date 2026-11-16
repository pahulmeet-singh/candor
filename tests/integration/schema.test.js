import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { isUniqueViolation } from "@/lib/prisma-errors";
import { bookInterview } from "@/lib/services/booking";
import { NOW, bookingInput, createUser, freshSlot, resetDatabase } from "./helpers";

/**
 * These tests read the migration back through the database: the constraints that the schema
 * promises (and the study guide explains) really exist in PostgreSQL.
 */
describe("the schema's constraints, as created by the migration", () => {
  before(resetDatabase);
  after(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("deleting a user removes their interviews and reports (ON DELETE CASCADE)", async () => {
    const user = await createUser("cascade");
    const booked = await bookInterview(user.id, bookingInput(freshSlot()), NOW);
    await prisma.feedback.create({ data: { interviewId: booked.id, overallScore: 70, evaluation: {}, model: "test" } });

    await prisma.user.delete({ where: { id: user.id } });

    assert.equal(await prisma.interview.count({ where: { id: booked.id } }), 0);
    assert.equal(await prisma.feedback.count({ where: { interviewId: booked.id } }), 0);
  });

  it("deleting a résumé keeps the interview and clears its link (ON DELETE SET NULL)", async () => {
    const user = await createUser("resume");
    await prisma.resume.create({
      data: { userId: user.id, fileName: "cv.pdf", storagePath: `${user.id}/cv.pdf`, sizeBytes: 1024 },
    });
    const booked = await bookInterview(user.id, bookingInput(freshSlot(), { useResume: true }), NOW);
    assert.equal((await prisma.interview.findUniqueOrThrow({ where: { id: booked.id } })).resumeId !== null, true);

    await prisma.resume.delete({ where: { userId: user.id } });

    const reloaded = await prisma.interview.findUniqueOrThrow({ where: { id: booked.id } });
    assert.equal(reloaded.resumeId, null);
    assert.equal(reloaded.status, "SCHEDULED");
  });

  it("rejects a duplicate email in the database itself (UNIQUE)", async () => {
    const email = "unique-email@integration.test";
    await prisma.user.create({ data: { email } });

    await assert.rejects(prisma.user.create({ data: { email } }), (error) => isUniqueViolation(error));
  });

  it("allows one report per interview (UNIQUE on Feedback.interviewId)", async () => {
    const user = await createUser("one-report");
    const booked = await bookInterview(user.id, bookingInput(freshSlot()), NOW);
    const report = { interviewId: booked.id, overallScore: 55, evaluation: {}, model: "test" };
    await prisma.feedback.create({ data: report });

    await assert.rejects(prisma.feedback.create({ data: report }), (error) => isUniqueViolation(error));
  });
});
