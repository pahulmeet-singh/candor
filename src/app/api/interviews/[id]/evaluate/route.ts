import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { PUBLIC_STATS_TAG } from "@/lib/data/public-stats";
import { NO_STORE, readJsonObject, withApiParams } from "@/lib/http";
import { assertWithinRate } from "@/lib/rate-limit";
import { submitInterview } from "@/lib/services/session";
import { interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";
import { submitSchema } from "@/lib/validations/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/interviews/:id/evaluate submits the answers, asks the model to
 * grade them, stores the report and returns its id.
 *
 * After a new report exists three cached things are stale, and each is
 * refreshed the way that suits it: the signed-in pages with `revalidatePath`,
 * and the anonymous landing-page counters with `revalidateTag`.
 */
export const POST = withApiParams<{ id: string }>("interviews.evaluate", async (request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  assertWithinRate(`evaluate:${user.id}`, 5, 10 * 60_000);
  const { answers } = parseInput(submitSchema, await readJsonObject(request));

  const result = await submitInterview(user.id, id, answers);

  if (!result.alreadySubmitted) {
    revalidatePath("/interviews");
    revalidatePath("/feedback");
    revalidatePath("/dashboard");
    revalidateTag(PUBLIC_STATS_TAG, "max");
  }
  return NextResponse.json(
    { feedbackId: result.feedbackId, overallScore: result.overallScore },
    { headers: NO_STORE },
  );
});
