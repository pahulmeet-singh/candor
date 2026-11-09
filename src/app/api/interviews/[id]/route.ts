import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { getInterview } from "@/lib/data/interviews";
import { AppError } from "@/lib/errors";
import { NO_STORE, readJsonObject, withApiParams } from "@/lib/http";
import { assertWithinRate } from "@/lib/rate-limit";
import { cancelInterview } from "@/lib/services/booking";
import { saveAnswer } from "@/lib/services/session";
import { interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";
import { saveAnswerSchema } from "@/lib/validations/session";

type Params = { id: string };

export const dynamic = "force-dynamic";

/** GET /api/interviews/:id. A booking that is not yours is a 404, the same as one that does not exist. */
export const GET = withApiParams<Params>("interviews.get", async (_request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  const interview = await getInterview(user.id, id);
  if (!interview) throw new AppError("NOT_FOUND", "We could not find that interview.");
  return NextResponse.json(interview, { headers: NO_STORE });
});

/** PATCH /api/interviews/:id with `{ questionId, text }` saves one answer (a partial update of the transcript). */
export const PATCH = withApiParams<Params>("interviews.saveAnswer", async (request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  assertWithinRate(`save:${user.id}`, 120, 60_000);
  const body = await readJsonObject(request);
  const input = parseInput(saveAnswerSchema, { ...body, interviewId: id });
  const saved = await saveAnswer(user.id, input);
  return NextResponse.json(saved, { headers: NO_STORE });
});

/** DELETE /api/interviews/:id cancels a booking. The row is kept (status CANCELLED) so history stays honest. */
export const DELETE = withApiParams<Params>("interviews.cancel", async (_request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  assertWithinRate(`cancel:${user.id}`, 20, 60_000);
  const interview = await cancelInterview(user.id, id);
  revalidatePath("/interviews");
  revalidatePath("/dashboard");
  return NextResponse.json(interview, { headers: NO_STORE });
});
