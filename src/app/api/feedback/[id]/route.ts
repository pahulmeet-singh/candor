import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { getFeedback } from "@/lib/data/feedback";
import { AppError } from "@/lib/errors";
import { NO_STORE, withApiParams } from "@/lib/http";
import { interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";

export const dynamic = "force-dynamic";

/** GET /api/feedback/:id returns one full report (scores, annotations, model answers, transcript). */
export const GET = withApiParams<{ id: string }>("feedback.get", async (_request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  const feedback = await getFeedback(user.id, id);
  if (!feedback) throw new AppError("NOT_FOUND", "We could not find that report.");
  return NextResponse.json(feedback, { headers: NO_STORE });
});
