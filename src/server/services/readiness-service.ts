import { getServerEnv } from "@/config/server-env";
import { prisma } from "@/db/client";

export interface ReadinessResponse {
  status: "ready" | "degraded";
  service: "twoplayer-web";
  version: string;
  timestamp: string;
  checks: {
    configuration: "ok" | "error";
    database: "configured" | "not_configured";
  };
}

let dependencyCache: { at: number; ok: boolean } | undefined;
const DEPENDENCY_CACHE_MS = 5_000;

async function databaseReady(): Promise<boolean> {
  const now = Date.now();
  if (dependencyCache && now - dependencyCache.at < DEPENDENCY_CACHE_MS)
    return dependencyCache.ok;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error("database readiness timeout")),
          1_000,
        ),
      ),
    ]);
    dependencyCache = { at: now, ok: true };
  } catch {
    dependencyCache = { at: now, ok: false };
  }
  return dependencyCache.ok;
}

export async function getReadinessStatus(now = new Date()) {
  const version = process.env.npm_package_version ?? "0.1.0";
  try {
    const env = getServerEnv();
    const configured = Boolean(env.database.url);
    const database =
      configured && (await databaseReady()) ? "configured" : "not_configured";
    return {
      httpStatus:
        env.auth.mode === "database" && database === "not_configured"
          ? 503
          : 200,
      body: {
        status:
          env.auth.mode === "database" && database === "not_configured"
            ? "degraded"
            : "ready",
        service: "twoplayer-web",
        version,
        timestamp: now.toISOString(),
        checks: { configuration: "ok", database },
      } satisfies ReadinessResponse,
    } as const;
  } catch {
    return {
      httpStatus: 503,
      body: {
        status: "degraded",
        service: "twoplayer-web",
        version,
        timestamp: now.toISOString(),
        checks: { configuration: "error", database: "not_configured" },
      } satisfies ReadinessResponse,
    } as const;
  }
}
