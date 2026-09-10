import "server-only";
import { LobbyError, LEASE_MS, type PresenceSummary } from "@/domain/lobby";
import type { PresenceService } from "@/realtime/lobby-contracts";

export interface RateLimiter {
  consume(key: string, limit: number, windowMs: number): Promise<void>;
}
export interface EphemeralStore extends PresenceService, RateLimiter {}
export class LocalEphemeralStore implements EphemeralStore {
  private leases = new Map<
    string,
    { userId: string; roomId: string | null; at: number }
  >();
  private limits = new Map<string, { count: number; until: number }>();
  private static readonly MAX_LIMIT_KEYS = 10_000;
  constructor(private now = () => Date.now()) {}
  async heartbeat(userId: string, roomId: string | null) {
    this.prune();
    // Per-room leases let multiple tabs coexist without premature disconnects.
    this.leases.set(`${userId}:${roomId ?? "platform"}`, {
      userId,
      roomId,
      at: this.now(),
    });
  }
  async lastSeen(roomId: string, userIds: string[]) {
    this.prune();
    return Object.fromEntries(
      userIds.map((id) => [id, this.leases.get(`${id}:${roomId}`)?.at ?? null]),
    );
  }
  async summary(): Promise<PresenceSummary> {
    this.prune();
    const live = [...this.leases.values()].filter(
      (entry) => this.now() - entry.at < LEASE_MS,
    );
    return {
      online: new Set(live.map((e) => e.userId)).size,
      inLobby: new Set(live.filter((e) => e.roomId).map((e) => e.userId)).size,
      inGame: 0,
    };
  }
  async consume(key: string, limit: number, windowMs: number) {
    this.prune();
    if (
      !this.limits.has(key) &&
      this.limits.size >= LocalEphemeralStore.MAX_LIMIT_KEYS
    ) {
      const oldest = this.limits.keys().next().value;
      if (oldest) this.limits.delete(oldest);
    }
    const value = this.limits.get(key) ?? {
      count: 0,
      until: this.now() + windowMs,
    };
    value.count++;
    this.limits.set(key, value);
    if (value.count > limit) throw new LobbyError("RATE_LIMITED");
  }
  private prune() {
    for (const [key, value] of this.leases)
      if (this.now() - value.at >= 180_000) this.leases.delete(key);
    for (const [key, value] of this.limits)
      if (value.until <= this.now()) this.limits.delete(key);
  }
}
/** Redis REST is ephemeral infrastructure; Ably remains the sole realtime provider. */
export class RedisEphemeralStore implements EphemeralStore {
  constructor(
    private url: string,
    private token: string,
    private now = () => Date.now(),
  ) {}
  private async command<T>(command: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new LobbyError("SERVICE_UNAVAILABLE");
    const body = (await response.json()) as { result: T; error?: string };
    if (body.error) throw new LobbyError("SERVICE_UNAVAILABLE");
    return body.result;
  }
  async heartbeat(userId: string, roomId: string | null) {
    const script =
      "for i,key in ipairs(KEYS) do redis.call('ZADD',key,ARGV[1],ARGV[2]); redis.call('ZREMRANGEBYSCORE',key,'-inf',ARGV[3]); redis.call('PEXPIRE',key,180000); end return 1";
    const keys = [
      "tp:presence:online",
      ...(roomId ? ["tp:presence:lobby", `tp:presence:room:${roomId}`] : []),
    ];
    await this.command([
      "EVAL",
      script,
      keys.length,
      ...keys,
      this.now(),
      userId,
      this.now() - 180_000,
    ]);
  }
  async lastSeen(roomId: string, userIds: string[]) {
    if (!userIds.length) return {};
    const scores = await this.command<(string | null)[]>([
      "ZMSCORE",
      `tp:presence:room:${roomId}`,
      ...userIds,
    ]);
    return Object.fromEntries(
      userIds.map((id, index) => [
        id,
        scores[index] == null ? null : Number(scores[index]),
      ]),
    );
  }
  async summary(): Promise<PresenceSummary> {
    const values = await this.command<number[]>([
      "EVAL",
      "return {redis.call('ZCOUNT',KEYS[1],ARGV[1],'+inf'),redis.call('ZCOUNT',KEYS[2],ARGV[1],'+inf')}",
      2,
      "tp:presence:online",
      "tp:presence:lobby",
      this.now() - LEASE_MS + 1,
    ]);
    return { online: values[0] ?? 0, inLobby: values[1] ?? 0, inGame: 0 };
  }
  async consume(key: string, limit: number, windowMs: number) {
    const count = await this.command<number>([
      "EVAL",
      "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]); end return n",
      1,
      `tp:limit:${key}`,
      windowMs,
    ]);
    if (count > limit) throw new LobbyError("RATE_LIMITED");
  }
}
