import { describe, expect, it } from "vitest";

import { parsePublicEnv, parseServerEnv } from "./env-schema";

describe("environment validation", () => {
  it("groups valid server configuration without exposing raw keys", () => {
    const result = parseServerEnv({
      DATABASE_URL:
        "postgresql://local-user:local-pass@localhost:5432/twoplayer",
      REALTIME_PROVIDER: "custom",
      REALTIME_SERVER_URL: "wss://realtime.example.test/session",
      REALTIME_SERVER_API_KEY: "test-only-key",
      OTEL_EXPORTER_OTLP_ENDPOINT: "https://telemetry.example.test/v1/traces",
      SENTRY_DSN: "",
    });

    expect(result.database.url).toContain("postgresql://");
    expect(result.auth).toEqual({
      mode: "database",
      sessionCookieName: "twoplayer_session",
      sessionTtlDays: 30,
    });
    expect(result.realtime).toEqual({
      provider: "custom",
      serverUrl: "wss://realtime.example.test/session",
      apiKey: "test-only-key",
      redisUrl: undefined,
      redisToken: undefined,
    });
    expect(result.observability.sentryDsn).toBeUndefined();
  });

  it("requires a PostgreSQL database URL", () => {
    expect(() => parseServerEnv({})).toThrow(/DATABASE_URL/);
    expect(() =>
      parseServerEnv({ DATABASE_URL: "https://database.example.test" }),
    ).toThrow(/postgres/i);
  });

  it("accepts Vercel's managed Redis variables when custom values are blank", () => {
    const result = parseServerEnv({
      NODE_ENV: "production",
      DATABASE_URL: "postgresql://localhost:5432/twoplayer",
      REALTIME_PROVIDER: "ably",
      REALTIME_SERVER_API_KEY: "test-only-ably-key",
      UPSTASH_REDIS_REST_URL: "",
      UPSTASH_REDIS_REST_TOKEN: " ",
      KV_REST_API_URL: "https://managed-redis.example.test",
      KV_REST_API_TOKEN: "test-only-managed-token",
    });
    expect(result.realtime.redisUrl).toBe("https://managed-redis.example.test");
    expect(result.realtime.redisToken).toBe("test-only-managed-token");
  });

  it("keeps custom Redis credentials together and rejects partial overrides", () => {
    const config = {
      DATABASE_URL: "postgresql://localhost:5432/twoplayer",
      REALTIME_PROVIDER: "ably",
      REALTIME_SERVER_API_KEY: "test-only-ably-key",
      UPSTASH_REDIS_REST_URL: "https://custom-redis.example.test",
      UPSTASH_REDIS_REST_TOKEN: "test-only-custom-token",
      KV_REST_API_URL: "https://managed-redis.example.test",
      KV_REST_API_TOKEN: "test-only-managed-token",
    };
    const result = parseServerEnv(config);
    expect(result.realtime.redisUrl).toBe(config.UPSTASH_REDIS_REST_URL);
    expect(result.realtime.redisToken).toBe(config.UPSTASH_REDIS_REST_TOKEN);
    expect(() =>
      parseServerEnv({ ...config, UPSTASH_REDIS_REST_TOKEN: "" }),
    ).toThrow(/UPSTASH_REDIS_REST_TOKEN/);
    expect(() =>
      parseServerEnv({ ...config, UPSTASH_REDIS_REST_URL: "" }),
    ).toThrow(/UPSTASH_REDIS_REST_URL/);
  });

  it("requires HTTPS for managed Redis endpoints", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost:5432/twoplayer",
        KV_REST_API_URL: "http://managed-redis.example.test",
        KV_REST_API_TOKEN: "test-only-token",
      }),
    ).toThrow(/Redis REST must use HTTPS/);
  });

  it("allows an explicit ephemeral development adapter without a database", () => {
    expect(
      parseServerEnv({ AUTH_MODE: "development" }).database.url,
    ).toBeUndefined();
  });

  it("rejects unsupported real-time endpoint protocols", () => {
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost:5432/twoplayer",
        REALTIME_SERVER_URL: "ftp://realtime.example.test",
      }),
    ).toThrow(/http, https, ws, or wss/);
  });

  it("validates explicit authentication mode and session settings", () => {
    expect(
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost:5432/twoplayer",
        AUTH_MODE: "development",
        SESSION_COOKIE_NAME: "two-player_session",
        SESSION_TTL_DAYS: "14",
      }).auth,
    ).toEqual({
      mode: "development",
      sessionCookieName: "two-player_session",
      sessionTtlDays: 14,
    });

    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost:5432/twoplayer",
        AUTH_MODE: "mock",
      }),
    ).toThrow(/AUTH_MODE/);
    expect(() =>
      parseServerEnv({
        DATABASE_URL: "postgresql://localhost:5432/twoplayer",
        SESSION_TTL_DAYS: "0",
      }),
    ).toThrow(/SESSION_TTL_DAYS/);
  });

  it("rejects the ephemeral authentication adapter in production", () => {
    expect(() =>
      parseServerEnv({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://localhost:5432/twoplayer",
        AUTH_MODE: "development",
      }),
    ).toThrow(/AUTH_MODE=development is not allowed in production/);
  });

  it("uses safe public defaults without reading server-only values", () => {
    expect(parsePublicEnv({})).toEqual({
      appUrl: "http://localhost:3000",
    });
  });
});
