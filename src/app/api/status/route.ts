import { getFeatureFlags } from "@/config/feature-flags";
import { getHealthStatus } from "@/server/services/health-service";

export const dynamic = "force-dynamic";
export function GET() {
  const flags = getFeatureFlags();
  const health = getHealthStatus();
  return Response.json(
    {
      ok: !flags.maintenance && health.httpStatus === 200,
      maintenance: flags.maintenance,
      gameAvailable: flags.gameAvailable,
      service: health.body.service,
      version: health.body.version,
      status: flags.maintenance ? "maintenance" : health.body.status,
    },
    {
      status: flags.maintenance ? 503 : health.httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
