import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { NO_STORE, readJsonObject, withApiParams } from "@/lib/http";
import { assertWithinRate } from "@/lib/rate-limit";
import { recordIntegrityEvents } from "@/lib/services/integrity";
import { interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";
import { integrityBatchSchema } from "@/lib/validations/integrity";

export const dynamic = "force-dynamic";

/**
 * POST /api/interviews/:id/integrity receives the events the integrity monitor collected in the
 * browser (a face out of frame, a tab that was left, a large paste) while an ASSESSMENT interview
 * is running, and stores the ones that pass the checks in `ingestEvents`.
 *
 * It is a Route Handler rather than a Server Action on purpose. The browser sends batches from a
 * timer and, as the page closes, with `fetch(..., { keepalive: true })`, which a Server Action
 * cannot do, and the monitor needs a response it can read (`saved` and `dropped`) without
 * re-rendering anything. Nothing here is cached or revalidated: the data is only read when a
 * report is opened.
 *
 * The limit is generous for the browser's real rhythm (one batch every ten seconds) and stops a
 * script from filling the table.
 */
export const POST = withApiParams("interviews.integrity", async (request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  assertWithinRate(`integrity:${user.id}`, 30, 60_000);
  const batch = parseInput(integrityBatchSchema, await readJsonObject(request));

  const result = await recordIntegrityEvents(user.id, id, batch);
  return NextResponse.json(result, { headers: NO_STORE });
});
