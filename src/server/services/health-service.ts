import { getServerEnv } from "@/config/server-env";

export interface HealthResponse {
  status: "ok" | "degraded";
  service: "twoplayer-web";
  version: string;
  timestamp: string;
  checks: {
    configuration: "ok" | "error";
  };
}

export interface HealthResult {
  httpStatus: 200 | 503;
  body: HealthResponse;
}

export function getHealthStatus(now = new Date()): HealthResult {
  try {
    getServerEnv();

    return {
      httpStatus: 200,
      body: {
        status: "ok",
        service: "twoplayer-web",
        version: process.env.npm_package_version ?? "0.1.0",
        timestamp: now.toISOString(),
        checks: {
          configuration: "ok",
        },
      },
    };
  } catch {
    return {
      httpStatus: 503,
      body: {
        status: "degraded",
        service: "twoplayer-web",
        version: process.env.npm_package_version ?? "0.1.0",
        timestamp: now.toISOString(),
        checks: {
          configuration: "error",
        },
      },
    };
  }
}
