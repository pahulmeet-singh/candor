import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { NO_STORE, withApiParams } from "@/lib/http";
import { assertWithinRate } from "@/lib/rate-limit";
import { startInterview } from "@/lib/services/session";
import { interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";

export const dynamic = "force-dynamic";
/** Generating questions calls an external model; allow it more than the platform default. */
export const maxDuration = 60;

/**
 * POST /api/interviews/:id/questions starts the session and generates its
 * questions. It is a Route Handler because it is a slow call to Gemini that the
 * client wants to `await` with a progress state, and because the result (the
 * questions) is a response body rather than a page refresh.
 * Calling it again for a session that already started returns the same questions.
 */
export const POST = withApiParams<{ id: string }>("interviews.start", async (_request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  assertWithinRate(`start:${user.id}`, 8, 60_000);
  const interview = await startInterview(user.id, id);
  revalidatePath(`/interviews/${id}`);
  revalidatePath("/interviews");
  return NextResponse.json(interview, { headers: NO_STORE });
});
