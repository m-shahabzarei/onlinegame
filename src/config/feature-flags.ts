import { z } from "zod";

const booleanFlag = z.preprocess(
  (value) =>
    value === undefined
      ? undefined
      : value === true || value === "1" || value === "true",
  z.boolean(),
);
const flagsSchema = z
  .object({
    onboarding: booleanFlag.default(true),
    challenges: booleanFlag.default(true),
    cosmetics: booleanFlag.default(true),
    publicRooms: booleanFlag.default(true),
    analytics: booleanFlag.default(false),
    maintenance: booleanFlag.default(false),
    gameAvailable: booleanFlag.default(true),
    telemetrySampleRate: z.coerce.number().min(0).max(1).default(0.1),
  })
  .strict();
export type FeatureFlags = z.infer<typeof flagsSchema>;

export function getFeatureFlags(
  env: Record<string, string | undefined> = process.env,
): FeatureFlags {
  return flagsSchema.parse({
    onboarding: env.TWOPLAYER_FLAG_ONBOARDING,
    challenges: env.TWOPLAYER_FLAG_CHALLENGES,
    cosmetics: env.TWOPLAYER_FLAG_COSMETICS,
    publicRooms: env.TWOPLAYER_FLAG_PUBLIC_ROOMS,
    analytics: env.TWOPLAYER_FLAG_ANALYTICS,
    maintenance: env.TWOPLAYER_FLAG_MAINTENANCE,
    gameAvailable: env.TWOPLAYER_FLAG_GAME_AVAILABLE,
    telemetrySampleRate: env.TWOPLAYER_TELEMETRY_SAMPLE_RATE,
  });
}
