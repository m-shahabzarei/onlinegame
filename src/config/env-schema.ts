import { z } from "zod";

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value === "string" && value.trim() === "") {
    return undefined;
  }

  return value;
};

const optionalSecretSchema = z.preprocess(
  emptyStringToUndefined,
  z.string().trim().min(1).optional(),
);

function usesProtocol(value: string, allowed: readonly string[]): boolean {
  try {
    return allowed.includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

const publicUrlSchema = z
  .string()
  .url()
  .refine((value) => usesProtocol(value, ["http:", "https:"]), {
    message: "must use the http or https protocol",
  });

const realtimeUrlSchema = z
  .string()
  .url()
  .refine((value) => usesProtocol(value, ["http:", "https:", "ws:", "wss:"]), {
    message: "must use http, https, ws, or wss",
  });

const databaseUrlSchema = z
  .string()
  .trim()
  .min(1, "DATABASE_URL is required")
  .url()
  .refine((value) => usesProtocol(value, ["postgres:", "postgresql:"]), {
    message: "DATABASE_URL must use the postgres or postgresql protocol",
  });

const authModeSchema = z.enum(["database", "development"]);

const sessionCookieNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(
    /^[A-Za-z0-9_-]+$/,
    "SESSION_COOKIE_NAME may contain only letters, numbers, underscores, and hyphens",
  );

const sessionTtlDaysSchema = z.coerce.number().int().min(1).max(365);

const publicEnvInputSchema = z.object({
  NEXT_PUBLIC_APP_URL: publicUrlSchema.default("http://localhost:3000"),
});

const serverEnvInputSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.preprocess(
      emptyStringToUndefined,
      databaseUrlSchema.optional(),
    ),
    AUTH_MODE: z
      .preprocess(emptyStringToUndefined, authModeSchema.optional())
      .default("database"),
    SESSION_COOKIE_NAME: z
      .preprocess(emptyStringToUndefined, sessionCookieNameSchema.optional())
      .default("twoplayer_session"),
    SESSION_TTL_DAYS: z
      .preprocess(emptyStringToUndefined, sessionTtlDaysSchema.optional())
      .default(30),
    REALTIME_PROVIDER: z
      .preprocess(
        emptyStringToUndefined,
        z.string().trim().min(1).default("unconfigured"),
      )
      .default("unconfigured"),
    REALTIME_SERVER_URL: z.preprocess(
      emptyStringToUndefined,
      realtimeUrlSchema.optional(),
    ),
    REALTIME_SERVER_API_KEY: optionalSecretSchema,
    UPSTASH_REDIS_REST_URL: z.preprocess(
      emptyStringToUndefined,
      publicUrlSchema
        .refine(
          (url) => url.startsWith("https://"),
          "Redis REST must use HTTPS",
        )
        .optional(),
    ),
    UPSTASH_REDIS_REST_TOKEN: optionalSecretSchema,
    OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
      emptyStringToUndefined,
      publicUrlSchema.optional(),
    ),
    SENTRY_DSN: z.preprocess(
      emptyStringToUndefined,
      publicUrlSchema.optional(),
    ),
  })
  .superRefine((value, context) => {
    if (
      value.REALTIME_PROVIDER === "local" &&
      (value.NODE_ENV === "production" || value.AUTH_MODE !== "development")
    ) {
      context.addIssue({
        code: "custom",
        path: ["REALTIME_PROVIDER"],
        message:
          "Local realtime requires development auth and a non-production runtime",
      });
    }
    if (value.REALTIME_PROVIDER === "ably") {
      for (const key of [
        "REALTIME_SERVER_API_KEY",
        "UPSTASH_REDIS_REST_URL",
        "UPSTASH_REDIS_REST_TOKEN",
      ] as const) {
        if (!value[key])
          context.addIssue({
            code: "custom",
            path: [key],
            message: "Required for Ably lobby infrastructure",
          });
      }
    }
    if (value.AUTH_MODE === "database" && !value.DATABASE_URL) {
      context.addIssue({
        code: "custom",
        path: ["DATABASE_URL"],
        message: "DATABASE_URL is required when AUTH_MODE=database",
      });
    }

    if (value.NODE_ENV === "production" && value.AUTH_MODE === "development") {
      context.addIssue({
        code: "custom",
        path: ["AUTH_MODE"],
        message: "AUTH_MODE=development is not allowed in production",
      });
    }
  });

export interface PublicEnv {
  appUrl: string;
}

export interface ServerEnv {
  database: {
    url: string | undefined;
  };
  auth: {
    mode: "database" | "development";
    sessionCookieName: string;
    sessionTtlDays: number;
  };
  realtime: {
    provider: string;
    serverUrl: string | undefined;
    apiKey: string | undefined;
    redisUrl: string | undefined;
    redisToken: string | undefined;
  };
  observability: {
    otelEndpoint: string | undefined;
    sentryDsn: string | undefined;
  };
}

export function parsePublicEnv(
  input: Record<string, string | undefined>,
): PublicEnv {
  const parsed = publicEnvInputSchema.parse(input);

  return {
    appUrl: parsed.NEXT_PUBLIC_APP_URL,
  };
}

export function parseServerEnv(
  input: Record<string, string | undefined>,
): ServerEnv {
  const parsed = serverEnvInputSchema.parse(input);

  return {
    database: {
      url: parsed.DATABASE_URL,
    },
    auth: {
      mode: parsed.AUTH_MODE,
      sessionCookieName: parsed.SESSION_COOKIE_NAME,
      sessionTtlDays: parsed.SESSION_TTL_DAYS,
    },
    realtime: {
      provider: parsed.REALTIME_PROVIDER,
      serverUrl: parsed.REALTIME_SERVER_URL,
      apiKey: parsed.REALTIME_SERVER_API_KEY,
      redisUrl: parsed.UPSTASH_REDIS_REST_URL,
      redisToken: parsed.UPSTASH_REDIS_REST_TOKEN,
    },
    observability: {
      otelEndpoint: parsed.OTEL_EXPORTER_OTLP_ENDPOINT,
      sentryDsn: parsed.SENTRY_DSN,
    },
  };
}
