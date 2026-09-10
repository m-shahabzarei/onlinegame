// @vitest-environment node
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LocalRealtimePublisher } from "@/realtime/local-publisher";
import type { LobbyIdentity } from "@/domain/lobby";
import { PrismaRoomStateStore } from "./prisma-store";
import { LocalEphemeralStore } from "./ephemeral";
import { LobbyRoomService } from "./room-service";

const url = process.env.LOBBY_TEST_DATABASE_URL;
describe.skipIf(!url)("PostgreSQL room transactions", () => {
  let db: PrismaClient;
  let service: LobbyRoomService;
  let users: LobbyIdentity[];
  let gameId: string;
  beforeAll(async () => {
    if (!url || new URL(url).pathname !== "/phase3_test")
      throw new Error(
        "Integration tests require an isolated database named phase3_test.",
      );
    db = new PrismaClient({ datasources: { db: { url } } });
    const suffix = randomUUID().slice(0, 8);
    users = await Promise.all(
      [0, 1, 2].map((index) =>
        db.user.create({
          data: {
            username: `p3_${suffix}_${index}`,
            displayName: `Test ${index}`,
            isGuest: index === 1,
          },
        }),
      ),
    );
    const game = await db.game.upsert({
      where: { slug: "nightfall-protocol" },
      create: {
        slug: "nightfall-protocol",
        name: "Nightfall Protocol",
        description: "Preparation only",
        status: "ACTIVE",
        maxPlayers: 2,
      },
      update: {},
    });
    gameId = game.id;
    service = new LobbyRoomService(
      new PrismaRoomStateStore(db),
      new LocalEphemeralStore(),
      new LocalRealtimePublisher(),
    );
  });
  afterAll(async () => {
    if (!db) return;
    const ids = users?.map((u) => u.id) ?? [];
    const rooms = await db.room.findMany({
      where: { members: { some: { userId: { in: ids } } } },
      select: { id: true },
    });
    await db.match.deleteMany({
      where: { roomId: { in: rooms.map((r) => r.id) } },
    });
    await db.room.deleteMany({ where: { id: { in: rooms.map((r) => r.id) } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it("creates atomically, prevents concurrent overfill, reserves once, then transfers host", async () => {
    const a = users[0]!;
    const b = users[1]!;
    const c = users[2]!;
    const created = await service.execute(a, {
      type: "create",
      requestId: randomUUID(),
      slug: "nightfall-protocol",
      visibility: "PUBLIC",
    });
    const code = created.code;
    await service.heartbeat(a.id, code);
    const joins = await Promise.allSettled(
      [b, c].map((user) =>
        service.execute(user, { type: "join", requestId: randomUUID(), code }),
      ),
    );
    expect(joins.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const snapshot = await service.snapshot(a.id, code);
    expect(snapshot.members).toHaveLength(2);
    const partner = users.find(
      (u) => u.id === snapshot.members.find((m) => m.userId !== a.id)!.userId,
    )!;
    await service.heartbeat(partner.id, code);
    for (const user of [a, partner]) {
      const state = await service.snapshot(user.id, code);
      await service.execute(user, {
        type: "ready",
        ready: true,
        requestId: randomUUID(),
        code,
        expectedVersion: state.stateVersion,
      });
    }
    const ready = await service.snapshot(a.id, code);
    const start = {
      type: "start",
      requestId: randomUUID(),
      code,
      expectedVersion: ready.stateVersion,
    } as const;
    const [first, replay] = await Promise.all([
      service.execute(a, start),
      service.execute(a, start),
    ]);
    expect(first.room?.matchId).toBe(replay.room?.matchId);
    expect(
      await db.match.count({
        where: { gameId, room: { code }, status: "PENDING" },
      }),
    ).toBe(1);
    const prepared = await service.snapshot(a.id, code);
    await service.execute(a, {
      type: "leave",
      requestId: randomUUID(),
      code,
      expectedVersion: prepared.stateVersion,
    });
    const transferred = await service.snapshot(partner.id, code);
    expect(transferred).toMatchObject({
      status: "WAITING",
      matchId: null,
      members: [{ userId: partner.id, role: "HOST", ready: false }],
    });
    expect(
      await db.match.count({
        where: { gameId, room: { code }, status: "ABORTED" },
      }),
    ).toBe(1);
  });
  it("rolls back room metadata if host membership cannot persist", async () => {
    const creation = randomUUID();
    const count = await db.room.count();
    await expect(
      service.execute(
        {
          id: `missing_${creation}`,
          displayName: "Missing",
          avatarUrl: null,
          isGuest: false,
        },
        {
          type: "create",
          requestId: creation,
          slug: "nightfall-protocol",
          visibility: "PRIVATE",
        },
      ),
    ).rejects.toBeTruthy();
    expect(await db.room.count()).toBe(count);
  });
});
