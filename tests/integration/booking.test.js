import "./setup";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { prisma } from "@/lib/db";
import { bookInterview, cancelInterview, listSlots } from "@/lib/services/booking";
import { SLOT_RULES, addDays, dateKeyOf, slotStartsFor } from "@/lib/slots";
import { NOW, bookingInput, codeOf, createUser, createUsers, freshSlot, rejectsWith, resetDatabase } from "./helpers";

/** Seats currently held on a slot, counted straight from the table. */
const seatsTaken = (scheduledAt) => prisma.interview.count({ where: { scheduledAt, status: { not: "CANCELLED" } } });

describe("booking on a real PostgreSQL database", () => {
  before(resetDatabase);
  after(async () => {
    await resetDatabase();
    await prisma.$disconnect();
  });

  it("books a seat and shows it as 'mine' on the slot map", async () => {
    const user = await createUser("solo");
    const when = freshSlot();

    const booked = await bookInterview(user.id, bookingInput(when), NOW);
    assert.equal(booked.status, "SCHEDULED");
    assert.equal(booked.scheduledAt, when.toISOString());
    assert.equal(booked.durationMin, SLOT_RULES.lengthMinutes);

    const map = await listSlots(user.id, dateKeyOf(when), NOW);
    const slot = map.slots.find((entry) => entry.start === when.toISOString());
    assert.equal(slot?.state, "mine");
    assert.equal(slot?.booked, 1);
    assert.equal(map.activeBookings, 1);
  });

  it("refuses a second booking of the same slot by the same person", async () => {
    const user = await createUser("twice");
    const when = freshSlot();

    await bookInterview(user.id, bookingInput(when), NOW);
    await rejectsWith(bookInterview(user.id, bookingInput(when), NOW), "CONFLICT");
    assert.equal(await seatsTaken(when), 1);
  });

  it("rejects times that are off the grid, too soon or too far ahead", async () => {
    const user = await createUser("invalid");
    const real = freshSlot();
    const tooFar = slotStartsFor(addDays(dateKeyOf(NOW), SLOT_RULES.horizonDays + 1))[0];
    assert.ok(tooFar);

    const offGrid = new Date(real.getTime() + 7 * 60_000);
    const justBefore = new Date(real.getTime() - 10 * 60_000); // inside the 30-minute lead time

    await rejectsWith(bookInterview(user.id, bookingInput(offGrid), NOW), "SLOT_INVALID");
    await rejectsWith(bookInterview(user.id, bookingInput(real), justBefore), "SLOT_INVALID");
    await rejectsWith(bookInterview(user.id, bookingInput(tooFar), NOW), "SLOT_INVALID");
    assert.equal(await seatsTaken(real), 0);
  });

  it("asks for a saved résumé before it books tailored questions", async () => {
    const user = await createUser("no-resume");
    const error = await rejectsWith(
      bookInterview(user.id, bookingInput(freshSlot(), { useResume: true }), NOW),
      "VALIDATION",
    );
    assert.ok(error.fieldErrors?.useResume, "the error should point at the useResume field");
  });

  for (const round of [1, 2]) {
    it(
      `never overbooks: eight people race for the ${SLOT_RULES.capacity} seats of one slot (round ${round})`,
      { timeout: 60_000 },
      async () => {
        const when = freshSlot();
        const people = await createUsers(8, `racer${round}`);

        // All eight calls start together. The service retries the transactions PostgreSQL aborts.
        const results = await Promise.allSettled(
          people.map((person) => bookInterview(person.id, bookingInput(when), NOW)),
        );

        const won = results.filter((result) => result.status === "fulfilled");
        const lost = results.filter((result) => result.status === "rejected");

        assert.equal(won.length, SLOT_RULES.capacity, "exactly the free seats are given out");
        assert.equal(await seatsTaken(when), SLOT_RULES.capacity, "and the table agrees");
        for (const failure of lost) {
          const code = codeOf(failure.reason);
          assert.ok(["SLOT_FULL", "CONFLICT"].includes(code), `a loser should be told the slot is full, got ${code}`);
        }
      },
    );
  }

  it("stops a person at five upcoming bookings and allows another after a cancel", async () => {
    const user = await createUser("limit");
    const held = [];
    for (let count = 0; count < SLOT_RULES.maxActivePerUser; count++) {
      held.push(await bookInterview(user.id, bookingInput(freshSlot()), NOW));
    }

    const sixth = freshSlot();
    await rejectsWith(bookInterview(user.id, bookingInput(sixth), NOW), "LIMIT_REACHED");

    const first = held[0];
    assert.ok(first);
    await cancelInterview(user.id, first.id, NOW);

    const again = await bookInterview(user.id, bookingInput(sixth), NOW);
    assert.equal(again.status, "SCHEDULED");
  });

  it("cancelling frees the seat, works once, and only for the owner", async () => {
    const [a, b, c, d] = await createUsers(4, "seat");
    assert.ok(a && b && c && d);
    const when = freshSlot();

    const first = await bookInterview(a.id, bookingInput(when), NOW);
    await bookInterview(b.id, bookingInput(when), NOW);
    await bookInterview(c.id, bookingInput(when), NOW);
    await rejectsWith(bookInterview(d.id, bookingInput(when), NOW), "SLOT_FULL");

    // Somebody else's booking is invisible to you, not "forbidden".
    await rejectsWith(cancelInterview(d.id, first.id, NOW), "NOT_FOUND");

    const cancelled = await cancelInterview(a.id, first.id, NOW);
    assert.equal(cancelled.status, "CANCELLED");
    await rejectsWith(cancelInterview(a.id, first.id, NOW), "INVALID_STATE");

    // The freed seat can be taken, and the slot is full again.
    const taken = await bookInterview(d.id, bookingInput(when), NOW);
    assert.equal(taken.status, "SCHEDULED");
    assert.equal(await seatsTaken(when), SLOT_RULES.capacity);
  });
});
