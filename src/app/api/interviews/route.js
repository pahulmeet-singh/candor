import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { listInterviews } from "@/lib/data/interviews";
import { NO_STORE, readJson, withApi } from "@/lib/http";
import { assertWithinRate } from "@/lib/rate-limit";
import { bookInterview } from "@/lib/services/booking";
import { bookingSchema, interviewListSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";

export const dynamic = "force-dynamic";

/** GET /api/interviews?tab=upcoming|past|cancelled&page=1 */
export const GET = withApi("interviews.list", async (request) => {
  const user = await assertUser();
  const query = parseInput(interviewListSchema, Object.fromEntries(request.nextUrl.searchParams));
  const result = await listInterviews(user.id, query);
  return NextResponse.json(result, { headers: NO_STORE });
});

/**
 * POST /api/interviews: the REST twin of `bookInterviewAction`. Both call the
 * same service, so the rules (capacity, limits, transactions) cannot drift apart.
 */
export const POST = withApi("interviews.book", async (request) => {
  const user = await assertUser();
  assertWithinRate(`book:${user.id}`, 10, 60_000);
  const input = parseInput(bookingSchema, await readJson(request));
  const interview = await bookInterview(user.id, input);
  revalidatePath("/interviews");
  revalidatePath("/dashboard");
  return NextResponse.json(interview, {
    status: 201,
    headers: { ...NO_STORE, Location: `/api/interviews/${interview.id}` },
  });
});
