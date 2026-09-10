import "server-only";

import { parseServerEnv, type ServerEnv } from "./env-schema";

let cachedProductionEnv: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (process.env.NODE_ENV === "production" && cachedProductionEnv) {
    return cachedProductionEnv;
  }

  const parsed = parseServerEnv({
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    AUTH_MODE: process.env.AUTH_MODE,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
    SESSION_TTL_DAYS: process.env.SESSION_TTL_DAYS,
    REALTIME_PROVIDER: process.env.REALTIME_PROVIDER,
    REALTIME_SERVER_URL: process.env.REALTIME_SERVER_URL,
    REALTIME_SERVER_API_KEY: process.env.REALTIME_SERVER_API_KEY,
    UPSTASH_REDIS_REST_URL: process.env.UPSTASH_REDIS_REST_URL,
    UPSTASH_REDIS_REST_TOKEN: process.env.UPSTASH_REDIS_REST_TOKEN,
    OTEL_EXPORTER_OTLP_ENDPOINT: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    SENTRY_DSN: process.env.SENTRY_DSN,
  });

  if (process.env.NODE_ENV === "production") {
    cachedProductionEnv = parsed;
  }

  return parsed;
}
