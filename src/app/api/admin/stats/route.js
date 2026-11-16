import { NextResponse } from "next/server";
import { assertRole } from "@/lib/auth/session";
import { getAdminOverview } from "@/lib/data/admin";
import { NO_STORE, withApi } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/admin/stats: platform totals. 401 when signed out, 403 for a non-admin. */
export const GET = withApi("admin.stats", async () => {
  await assertRole("ADMIN");
  const overview = await getAdminOverview();
  return NextResponse.json(overview, { headers: NO_STORE });
});
