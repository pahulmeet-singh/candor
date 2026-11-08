import { NextResponse } from "next/server";
import { assertUser } from "@/lib/auth/session";
import { NO_STORE, withApiParams } from "@/lib/http";
import { createDownloadUrl } from "@/lib/services/resume";
import { interviewIdParamSchema } from "@/lib/validations/booking";
import { parseInput } from "@/lib/validations/common";

export const dynamic = "force-dynamic";

/**
 * GET /api/resume/:id/download
 *
 * The storage bucket is private, so the browser never receives a permanent
 * URL. This route checks that the résumé belongs to the caller, asks Supabase
 * for a link that expires in 60 seconds, and redirects to it.
 */
export const GET = withApiParams<{ id: string }>("resume.download", async (_request, params) => {
  const user = await assertUser();
  const { id } = parseInput(interviewIdParamSchema, params);
  const url = await createDownloadUrl(user.id, id);
  return NextResponse.redirect(url, { status: 302, headers: NO_STORE });
});
