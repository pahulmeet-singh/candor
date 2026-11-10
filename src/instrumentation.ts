import { logger } from "@/lib/logger";

/**
 * Next.js calls `register` once when a server instance starts. It is the hook
 * where an OpenTelemetry or Sentry SDK would be initialised; Candor has none yet.
 */
export function register(): void {
  logger.info("server.start", { runtime: process.env.NEXT_RUNTIME ?? "nodejs" });
}

/**
 * Called for every error thrown while rendering a page or running a Route
 * Handler or Server Action, including the ones the user only sees as a generic
 * "something went wrong" screen. One JSON line per error, tagged with where it
 * happened, is enough to debug a production failure from the host's log viewer.
 */
export function onRequestError(
  error: unknown,
  request: { path: string; method: string },
  context: { routerKind: string; routePath: string; routeType: string; renderSource?: string },
): void {
  logger.error("request.error", {
    error,
    path: request.path,
    method: request.method,
    routerKind: context.routerKind,
    routePath: context.routePath,
    routeType: context.routeType,
    renderSource: context.renderSource,
  });
}
