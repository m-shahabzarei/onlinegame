import { z } from "zod";
import {
  SIMULATION,
  simulationConfigSchema,
} from "../../src/game/shared/config";
export function serverConfig(env: Record<string, string | undefined>) {
  const parsed = z
    .object({
      NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
      GAMEPLAY_JOIN_SECRET: z.string().min(32),
      GAMEPLAY_CONTROL_SECRET: z.string().min(32),
      GAMEPLAY_ALLOWED_ORIGINS: z.string().min(1),
      GAMEPLAY_WEB_URL: z.url(),
      GAMEPLAY_PORT: z.coerce.number().int().min(1).max(65535).default(8080),
      GAMEPLAY_HOST: z.string().default("127.0.0.1"),
    })
    .parse(env);
  const origins = parsed.GAMEPLAY_ALLOWED_ORIGINS.split(",").map(
    (o) => new URL(o.trim()).origin,
  );
  if (
    parsed.NODE_ENV === "production" &&
    (origins.some((o) => !o.startsWith("https://")) ||
      !parsed.GAMEPLAY_WEB_URL.startsWith("https://"))
  )
    throw new Error(
      "Production gameplay requires HTTPS origins and callback URL",
    );
  return {
    port: parsed.GAMEPLAY_PORT,
    host: parsed.GAMEPLAY_HOST,
    origins,
    webUrl: parsed.GAMEPLAY_WEB_URL,
    joinSecret: parsed.GAMEPLAY_JOIN_SECRET,
    controlSecret: parsed.GAMEPLAY_CONTROL_SECRET,
    simulation: simulationConfigSchema.parse({
      ...SIMULATION,
      tickRate: Number(env.GAMEPLAY_TICK_RATE ?? SIMULATION.tickRate),
      inputRate: Number(env.GAMEPLAY_TICK_RATE ?? SIMULATION.tickRate),
      snapshotRate: Number(
        env.GAMEPLAY_SNAPSHOT_RATE ?? SIMULATION.snapshotRate,
      ),
      startupMs: Number(env.GAMEPLAY_STARTUP_MS ?? SIMULATION.startupMs),
      reconnectMs: Number(env.GAMEPLAY_RECONNECT_MS ?? SIMULATION.reconnectMs),
    }),
  };
}
