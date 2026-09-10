// Node-only module: imported by trusted web boundaries and the persistent service.
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { LIMITS, PROTOCOL_VERSION } from "./config";
import { GameError, participantSchema, reservationSchema } from "./protocol";
import { outcomeSchema } from "./pve";
const base = {
  v: z.literal(PROTOCOL_VERSION),
  jti: z.uuid(),
  iat: z.number().int(),
  exp: z.number().int(),
};
export const joinClaimsSchema = participantSchema
  .extend({
    ...base,
    aud: z.literal("twoplayer-gameplay"),
    matchId: z.string().max(128),
    roomId: z.string().max(128),
    runtimeId: z.string().max(128),
  })
  .strict();
export type JoinClaims = z.infer<typeof joinClaimsSchema>;
export const controlClaimsSchema = z
  .object({
    ...base,
    aud: z.literal("twoplayer-control"),
    action: z.enum(["reserve", "cancel"]),
    reservation: reservationSchema,
  })
  .strict();
export const lifecycleClaimsSchema = z
  .object({
    ...base,
    aud: z.literal("twoplayer-lifecycle"),
    matchId: z.string().min(1).max(128),
    runtimeId: z.string().min(1).max(128),
    outcome: outcomeSchema.optional(),
    state: z.enum([
      "WAITING_FOR_PLAYERS",
      "LOADING",
      "COUNTDOWN",
      "PLAYING",
      "RECONNECTING",
      "CANCELLED",
      "ENDED",
      "ERROR",
    ]),
  })
  .strict();
export function tokenTimes(now = Date.now(), ttl: number = LIMITS.ticketMs) {
  return { v: PROTOCOL_VERSION, jti: randomUUID(), iat: now, exp: now + ttl };
}
export function signToken(payload: unknown, secret: string) {
  if (secret.length < 32)
    throw new Error("Gameplay signing key must contain at least 32 characters");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret)
    .update(body)
    .digest("base64url");
  return `${body}.${signature}`;
}
export function verifyToken<T extends { iat: number; exp: number }>(
  token: string,
  secret: string,
  schema: z.ZodType<T>,
  now = Date.now(),
): T {
  if (secret.length < 32 || token.length > 8192)
    throw new GameError("UNAUTHORIZED");
  const parts = token.split(".");
  if (
    parts.length !== 2 ||
    !parts[0] ||
    !parts[1] ||
    !/^[A-Za-z0-9_-]+$/.test(parts[1])
  )
    throw new GameError("UNAUTHORIZED");
  const expected = createHmac("sha256", secret).update(parts[0]).digest();
  const supplied = Buffer.from(parts[1], "base64url");
  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  )
    throw new GameError("UNAUTHORIZED");
  let data: unknown;
  try {
    data = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    throw new GameError("UNAUTHORIZED");
  }
  const parsed = schema.safeParse(data);
  if (!parsed.success) throw new GameError("UNAUTHORIZED");
  if (parsed.data.exp <= now) throw new GameError("TOKEN_EXPIRED");
  if (
    parsed.data.iat > now + 3000 ||
    parsed.data.exp - parsed.data.iat > LIMITS.ticketMs ||
    parsed.data.exp <= parsed.data.iat
  )
    throw new GameError("UNAUTHORIZED");
  return parsed.data;
}
export class ReplayGuard {
  private used = new Map<string, number>();
  consume(jti: string, exp: number, now: number) {
    for (const [key, expiry] of this.used)
      if (expiry <= now) this.used.delete(key);
    if (this.used.has(jti)) throw new GameError("TOKEN_USED");
    if (this.used.size >= 10000) throw new GameError("RATE_LIMITED");
    this.used.set(jti, exp);
  }
}
