// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  HOST_GRACE_MS,
  LEASE_MS,
  ROOM_TTL_MS,
  type LobbyCommand,
  type LobbyIdentity,
} from "@/domain/lobby";
import { LocalRealtimePublisher } from "@/realtime/local-publisher";
import { LocalEphemeralStore } from "./ephemeral";
import { LobbyRoomService, roomChannel } from "./room-service";
import { LocalRoomStateStore } from "./store";

const a: LobbyIdentity = {
  id: "a",
  displayName: "Alpha",
  avatarUrl: null,
  isGuest: false,
};
const b: LobbyIdentity = {
  id: "b",
  displayName: "Bravo",
  avatarUrl: null,
  isGuest: true,
};
const c: LobbyIdentity = {
  id: "c",
  displayName: "Charlie",
  avatarUrl: null,
  isGuest: false,
};
let now: number;
let store: LocalRoomStateStore;
let presence: LocalEphemeralStore;
let bus: LocalRealtimePublisher;
let service: LobbyRoomService;
beforeEach(() => {
  now = 1_000_000;
  store = new LocalRoomStateStore();
  presence = new LocalEphemeralStore(() => now);
  bus = new LocalRealtimePublisher();
  service = new LobbyRoomService(store, presence, bus, undefined, () => now);
});
async function create(visibility: "PUBLIC" | "PRIVATE" = "PUBLIC") {
  const result = await service.execute(a, {
    type: "create",
    requestId: randomUUID(),
    slug: "nightfall-protocol",
    visibility,
  });
  await service.heartbeat(a.id, result.code);
  return result.room!;
}
async function join(code: string, user = b) {
  const result = await service.execute(user, {
    type: "join",
    requestId: randomUUID(),
    code,
  });
  await service.heartbeat(user.id, code);
  return result.room!;
}
async function command(
  user: LobbyIdentity,
  code: string,
  action: Record<string, unknown>,
) {
  const room = await service.snapshot(user.id, code);
  return service.execute(user, {
    ...action,
    requestId: randomUUID(),
    code,
    expectedVersion: room.stateVersion,
  } as LobbyCommand);
}
async function readyPair() {
  const room = await create();
  await join(room.code);
  await command(a, room.code, { type: "ready", ready: true });
  await command(b, room.code, { type: "ready", ready: true });
  return room.code;
}

describe("atomic room lifecycle", () => {
  it("supports migrated rooms without pre-existing command receipts", async () => {
    const room = await create();
    const legacy = [...store.rooms.values()][0]!;
    legacy.receipts = [];
    store.rooms.set(legacy.code, legacy);
    await command(a, room.code, { type: "ready", ready: true });
    await command(a, room.code, { type: "ready", ready: false });
    expect([...store.rooms.values()][0]!.receipts).toHaveLength(2);
    expect((await service.snapshot(a.id, room.code)).members[0]!.ready).toBe(
      false,
    );
  });
  it("creates host and metadata together with server capacity and Not Ready", async () => {
    const room = await create();
    expect(room).toMatchObject({
      status: "WAITING",
      maxPlayers: 2,
      visibility: "PUBLIC",
      stateVersion: 1,
      members: [{ userId: "a", role: "HOST", ready: false }],
    });
    expect(room.code).toHaveLength(8);
    expect(store.rooms.size).toBe(1);
  });
  it("replays creation without creating another room and rejects changed payloads", async () => {
    const cmd = {
      type: "create",
      requestId: randomUUID(),
      slug: "nightfall-protocol",
      visibility: "PUBLIC",
    } as const;
    const first = await service.execute(a, cmd);
    const second = await service.execute(a, cmd);
    expect(second.code).toBe(first.code);
    expect(store.rooms.size).toBe(1);
    await expect(
      service.execute(a, { ...cmd, visibility: "PRIVATE" }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("retries code collisions", async () => {
    const room = await create();
    const generate = vi
      .fn()
      .mockReturnValueOnce(room.code)
      .mockReturnValue("ZZZZ8888");
    const second = new LobbyRoomService(
      store,
      presence,
      bus,
      undefined,
      () => now,
      generate,
    );
    const result = await second.execute(b, {
      type: "create",
      requestId: randomUUID(),
      slug: "nightfall-protocol",
      visibility: "PUBLIC",
    });
    expect(result.code).toBe("ZZZZ8888");
    expect(generate).toHaveBeenCalledTimes(2);
  });
  it("normalizes join input and makes duplicate membership requests safe", async () => {
    const room = await create();
    await join(room.code.toLowerCase());
    await join(room.code);
    const snap = await service.snapshot(a.id, room.code);
    expect(snap.members).toHaveLength(2);
    expect(snap.members[1]?.isGuest).toBe(true);
  });
  it("rejects a full public room and never leaks private details", async () => {
    const room = await create();
    await join(room.code);
    await expect(join(room.code, c)).rejects.toMatchObject({
      code: "ROOM_FULL",
    });
    await expect(service.snapshot(c.id, room.code)).rejects.toMatchObject({
      code: "ROOM_UNAVAILABLE",
    });
  });
  it("excludes private rooms from discovery and uses generic private rejection", async () => {
    const room = await create("PRIVATE");
    expect(await service.list("nightfall-protocol")).toEqual([]);
    await join(room.code);
    await expect(join(room.code, c)).rejects.toMatchObject({
      code: "ROOM_UNAVAILABLE",
    });
  });
  it("allows exactly one concurrent join into the last slot", async () => {
    const room = await create();
    const results = await Promise.allSettled([
      join(room.code, b),
      join(room.code, c),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await service.snapshot(a.id, room.code)).members).toHaveLength(2);
  });
  it("prevents an identity entering two incompatible rooms concurrently", async () => {
    const room = await create();
    const results = await Promise.allSettled([
      join(room.code, b),
      service.execute(b, {
        type: "create",
        requestId: randomUUID(),
        slug: "nightfall-protocol",
        visibility: "PUBLIC",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("requires server eligibility and rejects client identity, status, or capacity fields", async () => {
    const cmd = {
      type: "create",
      requestId: randomUUID(),
      slug: "nightfall-protocol",
      visibility: "PUBLIC",
      maxPlayers: 99,
      hostUserId: "fake",
    };
    await expect(service.execute(a, cmd as LobbyCommand)).rejects.toMatchObject(
      { code: "INVALID_INPUT" },
    );
    store.games.get("nightfall-protocol")!.status = "MAINTENANCE";
    await expect(create()).rejects.toMatchObject({ code: "GAME_UNAVAILABLE" });
  });
  it("rejects malformed and missing invites", async () => {
    await expect(join("invalid")).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    await expect(join("ZZZZ8888")).rejects.toMatchObject({
      code: "ROOM_UNAVAILABLE",
    });
  });
  it("commits expiration during rejected joins and removes expired cards", async () => {
    const room = await create();
    now += ROOM_TTL_MS;
    await expect(join(room.code)).rejects.toMatchObject({
      code: "ROOM_EXPIRED",
    });
    expect(store.rooms.get(room.code)?.status).toBe("EXPIRED");
    expect(await service.list("nightfall-protocol")).toEqual([]);
  });
  it("resets readiness on membership change", async () => {
    const room = await create();
    await command(a, room.code, { type: "ready", ready: true });
    await join(room.code);
    expect(
      (await service.snapshot(a.id, room.code)).members.every((m) => !m.ready),
    ).toBe(true);
  });
  it("authorizes own readiness and rejects client roles", async () => {
    const room = await create();
    await expect(
      command(a, room.code, { type: "ready", ready: true, userId: "b" }),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      service.execute(c, {
        type: "ready",
        ready: true,
        requestId: randomUUID(),
        code: room.code,
        expectedVersion: room.stateVersion,
      }),
    ).rejects.toMatchObject({ code: "ROOM_UNAVAILABLE" });
  });
  it.each(["start", "close", "kick", "cancel"])(
    "enforces host-only %s",
    async (type) => {
      const room = await create();
      await join(room.code);
      await expect(
        command(b, room.code, {
          type,
          ...(type === "kick"
            ? { targetUserId: "a" }
            : type === "cancel"
              ? { matchId: "no-match" }
              : {}),
        }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    },
  );
  it("makes commands idempotent and rejects stale state", async () => {
    const room = await create();
    const cmd = {
      type: "ready",
      requestId: randomUUID(),
      code: room.code,
      expectedVersion: room.stateVersion,
      ready: true,
    } as const;
    const first = await service.execute(a, cmd);
    const replay = await service.execute(a, cmd);
    expect(replay.room?.stateVersion).toBe(first.room?.stateVersion);
    await expect(
      service.execute(a, { ...cmd, requestId: randomUUID(), ready: false }),
    ).rejects.toMatchObject({ code: "STALE_STATE" });
    await expect(
      service.execute(a, { ...cmd, ready: false }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("blocks starting until exactly two connected players are ready", async () => {
    const room = await create();
    await expect(
      command(a, room.code, { type: "start" }),
    ).rejects.toMatchObject({ code: "NOT_READY" });
    await join(room.code);
    await command(a, room.code, { type: "ready", ready: true });
    await expect(
      command(a, room.code, { type: "start" }),
    ).rejects.toMatchObject({ code: "NOT_READY" });
  });
  it("atomically reserves a stable match and cancels back to waiting", async () => {
    const code = await readyPair();
    const snap = await service.snapshot(a.id, code);
    const cmd = {
      type: "start",
      requestId: randomUUID(),
      code,
      expectedVersion: snap.stateVersion,
    } as const;
    const first = await service.execute(a, cmd);
    const replay = await service.execute(a, cmd);
    expect(first.room?.status).toBe("STARTING");
    expect(replay.room?.matchId).toBe(first.room?.matchId);
    const cancelled = await command(a, code, {
      type: "cancel",
      matchId: first.room?.matchId,
    });
    expect(cancelled.room).toMatchObject({ status: "WAITING", matchId: null });
    expect(cancelled.room?.members.every((m) => !m.ready)).toBe(true);
  });
  it("rolls back a failed reservation and supports retry", async () => {
    const code = await readyPair();
    const failing = new LobbyRoomService(
      store,
      presence,
      bus,
      {
        reserve() {
          throw new Error("reservation unavailable");
        },
      },
      () => now,
    );
    const before = await service.snapshot(a.id, code);
    await expect(
      failing.execute(a, {
        type: "start",
        requestId: randomUUID(),
        code,
        expectedVersion: before.stateVersion,
      }),
    ).rejects.toThrow("reservation unavailable");
    expect(await service.snapshot(a.id, code)).toMatchObject({
      status: "WAITING",
      matchId: null,
      stateVersion: before.stateVersion,
    });
    expect(
      (await command(a, code, { type: "start" })).room?.matchId,
    ).toBeTruthy();
  });
  it("intentional host leave transfers immediately, last leave closes", async () => {
    const code = await readyPair();
    await command(a, code, { type: "leave" });
    const room = await service.snapshot(b.id, code);
    expect(room.members).toMatchObject([
      { userId: "b", role: "HOST", ready: false },
    ]);
    await command(b, code, { type: "leave" });
    expect(store.rooms.get(code)?.status).toBe("CLOSED");
    expect(await service.currentRoom(b.id)).toBeNull();
  });
  it("kick blocks rejoin and closes the old member's snapshot access", async () => {
    const code = await readyPair();
    await command(a, code, { type: "kick", targetUserId: b.id });
    await expect(service.snapshot(b.id, code)).rejects.toMatchObject({
      code: "ROOM_KICKED",
    });
    await expect(join(code)).rejects.toMatchObject({
      code: "ROOM_UNAVAILABLE",
    });
    expect((await service.snapshot(a.id, code)).members).toHaveLength(1);
  });
  it("host closes a room and broadcasts closure", async () => {
    const room = await create();
    const listener = vi.fn();
    bus.listen(roomChannel(store.rooms.get(room.code)!.id), listener);
    await command(a, room.code, { type: "close" });
    expect(listener).toHaveBeenCalledOnce();
    expect((await service.snapshot(a.id, room.code)).status).toBe("CLOSED");
    await expect(join(room.code)).rejects.toMatchObject({
      code: "ROOM_CLOSED",
    });
  });
});
describe("presence, host grace, reconnect, and realtime reconciliation", () => {
  it("preserves host through grace, resets readiness, restores valid membership on reconnect", async () => {
    const code = await readyPair();
    now += LEASE_MS + 1;
    await presence.heartbeat(b.id, store.rooms.get(code)!.id);
    const stale = await service.snapshot(b.id, code);
    expect(stale.members[0]).toMatchObject({
      userId: "a",
      role: "HOST",
      ready: false,
      connection: "RECONNECTING",
    });
    await service.heartbeat(a.id, code);
    expect((await service.snapshot(a.id, code)).members[0]?.connection).toBe(
      "CONNECTED",
    );
  });
  it("transfers host after grace and rejects stale host's recovery", async () => {
    const code = await readyPair();
    now += LEASE_MS + HOST_GRACE_MS + 1;
    await presence.heartbeat(b.id, store.rooms.get(code)!.id);
    const room = await service.snapshot(b.id, code);
    expect(room.members).toMatchObject([{ userId: "b", role: "HOST" }]);
    await expect(service.heartbeat(a.id, code)).rejects.toMatchObject({
      code: "MEMBERSHIP_ENDED",
    });
  });
  it("closes abandoned rooms lazily and expires presence without durable heartbeat changes", async () => {
    const room = await create();
    const before = structuredClone(store.rooms.get(room.code));
    await presence.heartbeat(a.id, null);
    expect(store.rooms.get(room.code)).toEqual(before);
    expect(await presence.summary()).toMatchObject({
      online: 1,
      inLobby: 1,
      inGame: 0,
    });
    now += LEASE_MS + HOST_GRACE_MS;
    expect(await presence.summary()).toMatchObject({ online: 0, inLobby: 0 });
    expect(await service.list("nightfall-protocol")).toEqual([]);
    expect(store.rooms.get(room.code)?.status).toBe("CLOSED");
  });
  it("duplicate tabs neither duplicate counts nor overwrite room leases", async () => {
    const room = await create();
    await presence.heartbeat(a.id, null);
    await presence.heartbeat(a.id, null);
    expect(await presence.summary()).toMatchObject({ online: 1, inLobby: 1 });
    expect(
      (await service.snapshot(a.id, room.code)).members[0]?.connection,
    ).toBe("CONNECTED");
  });
  it("returns interrupted preparation to WAITING with no stuck reservation", async () => {
    const code = await readyPair();
    await command(a, code, { type: "start" });
    now += LEASE_MS + 1;
    await presence.heartbeat(b.id, store.rooms.get(code)!.id);
    expect(await service.snapshot(b.id, code)).toMatchObject({
      status: "WAITING",
      matchId: null,
    });
  });
  it("two subscribers receive join, ready, leave and host changes then reconcile authoritative snapshots", async () => {
    const room = await create();
    const channel = roomChannel(store.rooms.get(room.code)!.id);
    const revisionsA: number[] = [];
    const revisionsB: number[] = [];
    const unsubA = bus.listen(channel, (n) => revisionsA.push(n));
    const unsubB = bus.listen(channel, (n) => revisionsB.push(n));
    await join(room.code);
    await command(b, room.code, { type: "ready", ready: true });
    await command(a, room.code, { type: "leave" });
    expect(revisionsA).toEqual(revisionsB);
    expect(revisionsA).toHaveLength(3);
    expect((await service.snapshot(b.id, room.code)).members[0]?.role).toBe(
      "HOST",
    );
    unsubA();
    unsubB();
    await command(b, room.code, { type: "close" });
    expect(revisionsA).toHaveLength(3);
  });
  it("keeps durable success recoverable if publication fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = new LobbyRoomService(
      store,
      presence,
      {
        publish: async () => {
          throw new Error("transport failure");
        },
      },
      undefined,
      () => now,
    );
    const room = await broken.execute(a, {
      type: "create",
      requestId: randomUUID(),
      slug: "nightfall-protocol",
      visibility: "PUBLIC",
    });
    expect(room.room?.status).toBe("WAITING");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
