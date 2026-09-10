// @vitest-environment node
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AuthSession } from "@/domain/auth";
import { PrismaRoomStateStore } from "@/server/lobby/prisma-store";
import { tokenTimes } from "@/game/shared/tokens";
import { GameplayBootstrapService } from "./service";
const url = process.env.LOBBY_TEST_DATABASE_URL;
describe.skipIf(!url)("durable gameplay lifecycle in PostgreSQL", () => {
  let db: PrismaClient;
  const userIds: string[] = [];
  const roomIds: string[] = [];
  beforeAll(() => {
    if (!url || new URL(url).pathname !== "/phase3_test")
      throw new Error("Requires isolated phase3_test database");
    db = new PrismaClient({ datasources: { db: { url } } });
  });
  afterAll(async () => {
    if (!db) return;
    await db.match.deleteMany({ where: { roomId: { in: roomIds } } });
    await db.room.deleteMany({ where: { id: { in: roomIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    await db.$disconnect();
  });
  it("claims once, persists meaningful state, ignores stale ownership, and aborts expired leases", async () => {
    const suffix = randomUUID().slice(0, 8);
    let now = Date.now();
    const users = await Promise.all(
      [0, 1].map((slot) =>
        db.user.create({
          data: {
            username: `p4_${suffix}_${slot}`,
            displayName: `Player ${slot}`,
            isGuest: slot === 1,
          },
        }),
      ),
    );
    userIds.push(...users.map((u) => u.id));
    const game = await db.game.upsert({
      where: { slug: "nightfall-protocol" },
      create: {
        slug: "nightfall-protocol",
        name: "Nightfall Protocol",
        description: "Training",
        status: "ACTIVE",
        maxPlayers: 2,
      },
      update: {},
    });
    const room = await db.room.create({
      data: {
        code: suffix.toUpperCase(),
        gameId: game.id,
        hostUserId: users[0]!.id,
        status: "STARTING",
        expiresAt: new Date(now + 7200000),
        members: {
          create: users.map((u, slot) => ({
            userId: u.id,
            role: slot === 0 ? "HOST" : "PLAYER",
            ready: true,
          })),
        },
        matches: { create: { gameId: game.id, status: "PENDING" } },
      },
      include: { matches: true },
    });
    roomIds.push(room.id);
    const matchId = room.matches[0]!.id;
    const service = new GameplayBootstrapService(
      new PrismaRoomStateStore(db),
      {
        epoch: async () => "epoch",
        reserve: async () => {},
        cancel: async () => {},
      },
      "database-fixture-secret-at-least-32",
      "ws://localhost/gameplay",
      () => now,
    );
    const sessions = users.map((u): AuthSession => ({
      id: `s-${u.id}`,
      userId: u.id,
      kind: u.isGuest ? "GUEST" : "USER",
      user: u,
      createdAt: new Date(now),
      expiresAt: new Date(now + 600000),
    }));
    await Promise.all(sessions.map((s) => service.bootstrap(s, matchId)));
    const claimed = await service.authorize(users[0]!.id, matchId);
    expect(claimed.status).toBe("IN_MATCH");
    const runtimeId = claimed.matchRuntime!.reservation.runtimeId;
    now += 1000;
    await service.lifecycle({
      ...tokenTimes(now),
      aud: "twoplayer-lifecycle",
      matchId,
      runtimeId,
      state: "PLAYING",
    });
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status,
    ).toBe("ACTIVE");
    await expect(
      service.lifecycle({
        ...tokenTimes(now + 1),
        aud: "twoplayer-lifecycle",
        matchId,
        runtimeId: "stale-owner",
        state: "ENDED",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    now += 46000;
    expect(await service.sweep()).toBe(1);
    expect(
      (await db.match.findUniqueOrThrow({ where: { id: matchId } })).status,
    ).toBe("ABORTED");
    expect(
      (await db.room.findUniqueOrThrow({ where: { id: room.id } })).status,
    ).toBe("CLOSED");
  });
});
