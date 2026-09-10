import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { getFeatureFlags } from "@/config/feature-flags";
import { log } from "@/server/observability/logger";

export const analyticsEventSchema = z
  .object({
    name: z.enum([
      "landing_viewed",
      "registration_completed",
      "guest_session_started",
      "onboarding_completed",
      "onboarding_skipped",
      "game_viewed",
      "room_created",
      "room_joined",
      "match_started",
      "match_completed",
      "match_abandoned",
      "reconnect_attempted",
      "reconnect_succeeded",
      "reconnect_failed",
      "shop_opened",
      "purchase_accepted",
      "purchase_rejected",
      "upgrade_accepted",
      "gate_unlocked",
      "objective_started",
      "objective_completed",
      "boss_reached",
      "boss_defeated",
      "victory",
      "defeat",
      "report_submitted",
      "challenge_started",
      "challenge_completed",
      "cosmetic_equipped",
    ]),
    version: z.literal(1),
    sessionId: z.string().min(1).max(128).optional(),
    userId: z.string().min(1).max(128).optional(),
    matchId: z.string().min(1).max(128).optional(),
    properties: z
      .record(
        z.string(),
        z.union([z.string().max(120), z.number().finite(), z.boolean()]),
      )
      .default({}),
  })
  .strict();
export type AnalyticsEvent = z.infer<typeof analyticsEventSchema>;

const pseudonym = (value: string) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);
export function track(event: unknown, optedOut = false) {
  if (optedOut || !getFeatureFlags().analytics) return false;
  const parsed = analyticsEventSchema.safeParse(event);
  if (!parsed.success) return false;
  const safe = {
    ...parsed.data,
    ...(parsed.data.userId ? { userId: pseudonym(parsed.data.userId) } : {}),
    ...(parsed.data.sessionId
      ? { sessionId: pseudonym(parsed.data.sessionId) }
      : {}),
    ...(parsed.data.matchId ? { matchId: pseudonym(parsed.data.matchId) } : {}),
  };
  queueMicrotask(() => log("info", "product_analytics", safe));
  return true;
}
