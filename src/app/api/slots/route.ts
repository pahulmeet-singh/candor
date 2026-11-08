import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { NO_STORE, withApi } from "@/lib/http";
import { listSlots } from "@/lib/services/booking";
import { dateKeyOf } from "@/lib/slots";
import { slotsQuerySchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";

/**
 * GET /api/slots?date=YYYY-MM-DD
 *
 * The booking page is a Client Component that calls this each time the user
 * picks a day. It is a Route Handler (not a Server Action) because it is a
 * read: GET can be cached, retried and called by anything that speaks HTTP,
 * while Server Actions are for mutations triggered by our own UI.
 */
export const dynamic = "force-dynamic";

export const GET = withApi("slots.list", async (request) => {
  const user = await assertUser();
  const { date } = parseInput(slotsQuerySchema, {
    date: request.nextUrl.searchParams.get("date") ?? dateKeyOf(new Date()),
  });
  const slots = await listSlots(user.id, date);
  return NextResponse.json(slots, { headers: NO_STORE });
});
