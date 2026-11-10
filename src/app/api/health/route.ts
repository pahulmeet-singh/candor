/**
 * GET /api/health: a liveness probe for the host or an uptime monitor.
 *
 * It is the one route that runs on the Edge runtime. Edge functions start in
 * milliseconds and run close to the user, but they cannot open TCP connections
 * (so no Prisma, no `pg`) and cannot use Node-only APIs. A probe that only
 * answers "is the deployment up?" needs none of that, which makes it a good fit.
 * Everything that touches the database stays on the Node.js runtime.
 */
export const runtime = "edge";
export const dynamic = "force-dynamic";

export function GET(): Response {
  return Response.json(
    { status: "ok", service: "candor", runtime: "edge", time: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
