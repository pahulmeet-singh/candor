import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { PublicStatsDTO } from "@/lib/types";

/**
 * Anonymous, site-wide counters for the landing page.
 *
 * The page itself is ISR (it is rebuilt at most every 10 minutes). On top of
 * that the query result is stored in the Data Cache under the tag
 * `public-stats`, so a Route Handler can refresh the numbers immediately with
 * `revalidateTag(PUBLIC_STATS_TAG, "max")` when a new report is written,
 * instead of waiting for the timer.
 */

export const PUBLIC_STATS_TAG = "public-stats";

const loadPublicStats = unstable_cache(
  async (): Promise<PublicStatsDTO> => {
    const [interviews, reports, learners] = await Promise.all([
      prisma.interview.count({ where: { status: "COMPLETED" } }),
      prisma.feedback.count(),
      prisma.user.count(),
    ]);
    return { interviews, reports, learners };
  },
  ["public-stats-v1"],
  { tags: [PUBLIC_STATS_TAG], revalidate: 600 },
);

/**
 * `null` when the database cannot be reached. A failed read must not break the
 * landing page (or `next build` on a machine with no database), and errors are
 * not cached, so the next regeneration simply tries again.
 */
export async function getPublicStats(): Promise<PublicStatsDTO | null> {
  try {
    return await loadPublicStats();
  } catch (error) {
    logger.warn("public-stats.unavailable", { error });
    return null;
  }
}
