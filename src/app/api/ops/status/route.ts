import { timingSafeEqual } from "node:crypto";
import { getFeatureFlags } from "@/config/feature-flags";
import { getHealthStatus } from "@/server/services/health-service";
import { log } from "@/server/observability/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const configured = process.env.OPS_HEALTH_TOKEN;
  const supplied = request.headers.get("authorization") ?? "";
  if (!configured || !supplied.startsWith("Bearer ")) return false;
  const expected = Buffer.from(`Bearer ${configured}`);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function GET(request: Request) {
  if (!authorized(request))
    return Response.json(
      { ok: false, code: "UNAUTHORIZED" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  const health = getHealthStatus();
  const flags = getFeatureFlags();
  log("info", "operator_status_viewed", { operator: "authenticated" });
  return Response.json(
    {
      ok: true,
      version: health.body.version,
      health: health.body.status,
      maintenance: flags.maintenance,
      gameAvailable: flags.gameAvailable,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
