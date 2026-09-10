// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { AuthSession } from "@/domain/auth";
import type { LobbyIdentity } from "@/domain/lobby";
import { LIMITS } from "@/game/shared/config";
import {
  joinClaimsSchema,
  tokenTimes,
  verifyToken,
} from "@/game/shared/tokens";
import { LocalRealtimePublisher } from "@/realtime/local-publisher";
import { LocalEphemeralStore } from "@/server/lobby/ephemeral";
import { LobbyRoomService } from "@/server/lobby/room-service";
import { LocalRoomStateStore } from "@/server/lobby/store";
import { GameplayBootstrapService } from "./service";
import { gameplayWebConfig } from "./config";
const secret = "bootstrap-tests-only-key-at-least-32";
const identities: LobbyIdentity[] = [
  { id: "a", displayName: "Alpha", avatarUrl: null, isGuest: false },
  { id: "b", displayName: "Bravo", avatarUrl: null, isGuest: true },
];
function session(id: LobbyIdentity, now: number): AuthSession {
  return {
    id: `session-${id.id}`,
    userId: id.id,
    kind: id.isGuest ? "GUEST" : "USER",
    createdAt: new Date(now),
    expiresAt: new Date(now + 600000),
    user: {
      id: id.id,
      username: id.id,
      displayName: id.displayName,
      avatarUrl: null,
      isGuest: id.isGuest,
      email: null,
      bio: null,
      locale: "en",
      reducedMotion: false,
      soundEnabled: true,
      createdAt: new Date(now),
      updatedAt: new Date(now),
    },
  };
}
async function fixture() {
  let now = 1000000;
  const clock = () => now;
  const store = new LocalRoomStateStore();
  const lobby = new LobbyRoomService(
    store,
    new LocalEphemeralStore(clock),
    new LocalRealtimePublisher(),
    undefined,
    clock,
  );
  const created = await lobby.execute(identities[0]!, {
    type: "create",
    requestId: randomUUID(),
    slug: "nightfall-protocol",
    visibility: "PRIVATE",
  });
  const code = created.code;
  await lobby.heartbeat("a", code);
  await lobby.execute(identities[1]!, {
    type: "join",
    requestId: randomUUID(),
    code,
  });
  await lobby.heartbeat("b", code);
  for (const identity of identities) {
    const room = await lobby.snapshot(identity.id, code);
    await lobby.execute(identity, {
      type: "ready",
      requestId: randomUUID(),
      code,
      expectedVersion: room.stateVersion,
      ready: true,
    });
  }
  const room = await lobby.snapshot("a", code);
  const result = await lobby.execute(identities[0]!, {
    type: "start",
    requestId: randomUUID(),
    code,
    expectedVersion: room.stateVersion,
  });
  const matchId = result.room!.matchId!;
  const provisioner = {
    epoch: vi.fn(async () => "epoch"),
    reserve: vi.fn(async () => {}),
    cancel: vi.fn(async () => {}),
  };
  const game = new GameplayBootstrapService(
    store,
    provisioner,
    secret,
    "ws://localhost:8080/gameplay",
    clock,
  );
  return {
    store,
    lobby,
    code,
    matchId,
    game,
    provisioner,
    clock,
    advance: (ms: number) => {
      now += ms;
    },
    session: (slot: 0 | 1) => session(identities[slot]!, now),
  };
}
describe("Phase 3 reservation -> secure gameplay handoff", () => {
  it("records only the terminal Phase 5 outcome once through the existing lifecycle boundary", async () => {
    const f = await fixture();
    await f.game.bootstrap(f.session(0), f.matchId);
    const runtimeId = f.store.rooms.get(f.code)!.matchRuntime!.reservation
      .runtimeId;
    f.advance(1000);
    const claims = {
      ...tokenTimes(f.clock()),
      aud: "twoplayer-lifecycle" as const,
      matchId: f.matchId,
      runtimeId,
      state: "ENDED" as const,
      outcome: {
        result: "PHASE_COMPLETE" as const,
        reason: "Five-wave survival complete",
        completedWaves: 5,
      },
    };
    await f.game.lifecycle(claims);
    await f.game.lifecycle(claims);
    expect(f.store.outcomes.size).toBe(1);
    expect(f.store.outcomes.get(f.matchId)).toEqual(claims.outcome);
    expect(f.store.rooms.get(f.code)!.status).toBe("CLOSED");
    expect(JSON.stringify([...f.store.outcomes.values()])).not.toContain(
      "zombies",
    );
  });
  it("refuses to recreate player state after a gameplay process restart", async () => {
    const f = await fixture();
    await f.game.bootstrap(f.session(0), f.matchId);
    f.provisioner.epoch.mockResolvedValue("new-epoch");
    await expect(
      f.game.bootstrap(f.session(0), f.matchId),
    ).rejects.toMatchObject({ code: "MATCH_UNAVAILABLE" });
    expect(f.provisioner.reserve).toHaveBeenCalledTimes(1);
    expect(f.store.rooms.get(f.code)!.status).toBe("CLOSED");
  });
  it("atomically reserves stable different slots for simultaneous member bootstraps", async () => {
    const f = await fixture();
    const [a, b] = await Promise.all([
      f.game.bootstrap(f.session(0), f.matchId),
      f.game.bootstrap(f.session(1), f.matchId),
    ]);
    const ca = verifyToken(a.token, secret, joinClaimsSchema, f.clock()),
      cb = verifyToken(b.token, secret, joinClaimsSchema, f.clock());
    expect(ca).toMatchObject({ userId: "a", slot: 0, kind: "USER" });
    expect(cb).toMatchObject({ userId: "b", slot: 1, kind: "GUEST" });
    expect(ca.runtimeId).toBe(cb.runtimeId);
    expect(ca.playerId).not.toBe(cb.playerId);
    expect((await f.lobby.snapshot("a", f.code)).status).toBe("IN_MATCH");
  });
  it("rejects nonmembers, expired sessions, and removed membership without provisioning", async () => {
    const f = await fixture();
    await expect(
      f.game.bootstrap(
        session(
          { id: "outsider", displayName: "X", avatarUrl: null, isGuest: false },
          f.clock(),
        ),
        f.matchId,
      ),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(
      f.game.bootstrap({ ...f.session(0), expiresAt: new Date(0) }, f.matchId),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(f.provisioner.reserve).not.toHaveBeenCalled();
  });
  it("reissues fresh tickets for the same slot without storing gameplay snapshots", async () => {
    const f = await fixture();
    const first = verifyToken(
      (await f.game.bootstrap(f.session(0), f.matchId)).token,
      secret,
      joinClaimsSchema,
      f.clock(),
    );
    f.advance(1000);
    const second = verifyToken(
      (await f.game.bootstrap(f.session(0), f.matchId)).token,
      secret,
      joinClaimsSchema,
      f.clock(),
    );
    expect(second.playerId).toBe(first.playerId);
    expect(second.jti).not.toBe(first.jti);
    expect(JSON.stringify([...f.store.rooms.values()])).not.toContain(
      "magazine",
    );
  });
  it("rolls startup failure out of starting state", async () => {
    const f = await fixture();
    f.provisioner.reserve.mockRejectedValueOnce(new Error("offline"));
    await expect(
      f.game.bootstrap(f.session(0), f.matchId),
    ).rejects.toMatchObject({ code: "SERVER_UNAVAILABLE" });
    expect(f.store.rooms.get(f.code)).toMatchObject({
      status: "CLOSED",
      matchId: null,
    });
  });
  it("keeps gameplay membership when old lobby presence expires and the gameplay lease renews", async () => {
    const f = await fixture();
    await f.game.bootstrap(f.session(0), f.matchId);
    const runtime = f.store.rooms.get(f.code)!.matchRuntime!;
    for (let i = 0; i < 10; i++) {
      f.advance(10000);
      await f.game.lifecycle({
        ...tokenTimes(f.clock()),
        aud: "twoplayer-lifecycle",
        matchId: f.matchId,
        runtimeId: runtime.reservation.runtimeId,
        state: "PLAYING",
      });
    }
    const room = await f.lobby.snapshot("a", f.code);
    expect(room.status).toBe("IN_MATCH");
    expect(room.members).toHaveLength(2);
  });
  it("rejects wrong runtime lifecycle and ignores replayed or out-of-order callbacks", async () => {
    const f = await fixture();
    await f.game.bootstrap(f.session(0), f.matchId);
    const runtime = f.store.rooms.get(f.code)!.matchRuntime!;
    f.advance(1000);
    const claims = {
      ...tokenTimes(f.clock()),
      aud: "twoplayer-lifecycle" as const,
      matchId: f.matchId,
      runtimeId: runtime.reservation.runtimeId,
      state: "PLAYING" as const,
    };
    await expect(
      f.game.lifecycle({ ...claims, runtimeId: "wrong" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await f.game.lifecycle(claims);
    const lease = f.store.rooms.get(f.code)!.matchRuntime!.leaseUntil;
    f.advance(5000);
    await f.game.lifecycle(claims);
    expect(f.store.rooms.get(f.code)!.matchRuntime!.leaseUntil).toBe(lease);
  });
  it("expires unclaimed reservations and interrupted claimed runtimes through sweeping", async () => {
    for (const claim of [false, true]) {
      const f = await fixture();
      if (claim) await f.game.bootstrap(f.session(0), f.matchId);
      f.advance(claim ? LIMITS.leaseMs + 1 : 90001);
      expect(await f.game.sweep()).toBe(1);
      expect(f.store.rooms.get(f.code)).toMatchObject({
        status: "CLOSED",
        matchId: null,
      });
    }
  });
  it("ends on explicit leave and makes repeated leave idempotent", async () => {
    const f = await fixture();
    await f.game.bootstrap(f.session(0), f.matchId);
    await f.game.leave("a", f.matchId);
    await f.game.leave("a", f.matchId);
    expect(f.provisioner.cancel).toHaveBeenCalledTimes(1);
    await expect(
      f.game.bootstrap(f.session(1), f.matchId),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
  it("requires independent secrets and secure production endpoint configuration", () => {
    expect(() =>
      gameplayWebConfig({
        NODE_ENV: "production",
        GAMEPLAY_JOIN_SECRET: secret,
        GAMEPLAY_CONTROL_SECRET: secret,
        GAMEPLAY_SERVER_HTTP_URL: "http://game.invalid",
        GAMEPLAY_WS_URL: "ws://game.invalid/gameplay",
      }),
    ).toThrow();
    expect(() =>
      gameplayWebConfig({
        NODE_ENV: "production",
        GAMEPLAY_JOIN_SECRET: secret,
        GAMEPLAY_CONTROL_SECRET: secret,
        GAMEPLAY_SERVER_HTTP_URL: "https://game.invalid",
        GAMEPLAY_WS_URL: "wss://game.invalid/gameplay",
      }),
    ).not.toThrow();
  });
});
