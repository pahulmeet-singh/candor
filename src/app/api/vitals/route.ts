import { clientIp, withApi } from "@/lib/http";
import { logger } from "@/lib/logger";
import { rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const KNOWN = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);

/**
 * POST /api/vitals receives Core Web Vitals from `components/shared/web-vitals.tsx`.
 * It only writes one structured log line per metric, which a log platform can
 * chart, and answers 204 (no body). Anonymous on purpose, so it is rate limited
 * per address and ignores anything that is not one of the five known metrics.
 */
export const POST = withApi("vitals.collect", async (request) => {
  const limited = rateLimit(`vitals:${await clientIp()}`, 60, 60_000);
  if (!limited.ok) return new Response(null, { status: 429 });

  const text = await request.text();
  if (text.length > 2_000) return new Response(null, { status: 413 });

  try {
    const metric = JSON.parse(text) as { name?: unknown; value?: unknown; rating?: unknown; path?: unknown };
    if (typeof metric.name === "string" && KNOWN.has(metric.name) && typeof metric.value === "number") {
      logger.info("web-vital", {
        name: metric.name,
        value: Math.round(metric.value * 100) / 100,
        rating: typeof metric.rating === "string" ? metric.rating.slice(0, 24) : undefined,
        path: typeof metric.path === "string" ? metric.path.slice(0, 120) : undefined,
      });
    }
  } catch {
    // A beacon that is not JSON is simply dropped.
  }
  return new Response(null, { status: 204 });
});
