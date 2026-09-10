import "server-only";
import { randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/db/client";
import {
  LobbyError,
  type RoomAggregate,
  type Receipt,
  type StoredMember,
} from "@/domain/lobby";
import type { RoomStateStore, RoomTransaction } from "./store";

const include = {
  game: true,
  members: {
    include: {
      user: {
        select: { id: true, displayName: true, avatarUrl: true, isGuest: true },
      },
    },
  },
  matches: {
    where: {
      status: { in: ["PENDING", "ACTIVE"] as ("PENDING" | "ACTIVE")[] },
    },
    orderBy: { createdAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.RoomInclude;
type Row = Prisma.RoomGetPayload<{ include: typeof include }>;
function aggregate(row: Row): RoomAggregate {
  return {
    id: row.id,
    code: row.code,
    game: row.game,
    hostUserId: row.hostUserId,
    visibility: row.visibility,
    status: row.status,
    maxPlayers: row.maxPlayers,
    mode: row.mode === "SOLO" ? "solo" : "coop",
    stateVersion: row.stateVersion,
    createdAt: +row.createdAt,
    updatedAt: +row.updatedAt,
    expiresAt: +row.expiresAt,
    creationKey: row.creationKey ?? `legacy:${row.id}`,
    receipts: row.commandReceipts as unknown as Receipt[],
    matchId: row.matches[0]?.id ?? null,
    ...(row.matches[0]?.gameplay
      ? {
          matchRuntime: row.matches[0].gameplay as unknown as NonNullable<
            RoomAggregate["matchRuntime"]
          >,
        }
      : {}),
    members: row.members.map((m) => ({
      user: m.user,
      role: m.role,
      ready: m.ready,
      joinedAt: +m.joinedAt,
      updatedAt: +m.updatedAt,
      removedAt: m.removedAt ? +m.removedAt : null,
      removalReason: m.removalReason as StoredMember["removalReason"],
    })),
  };
}
function transactionAdapter(tx: Prisma.TransactionClient): RoomTransaction {
  return {
    recordOutcome: async (matchId, outcome, endedAt) => {
      const changed = await tx.match.updateMany({
        where: { id: matchId, status: { in: ["PENDING", "ACTIVE"] } },
        data: {
          status: "COMPLETED",
          endedAt: new Date(endedAt),
          gameplay: { outcome } as unknown as Prisma.InputJsonValue,
        },
      });
      if (changed.count === 0) return;
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: { roomId: true },
      });
      if (!match) return;
      const members = await tx.roomMember.findMany({
        where: { roomId: match.roomId },
        select: { userId: true },
      });
      await tx.matchHistory.createMany({
        data: members.map((member) => ({
          id: randomUUID(),
          matchId,
          userId: member.userId,
          result:
            outcome.result === "PHASE_COMPLETE" ? "PHASE_COMPLETE" : "DEFEAT",
          completedWaves: outcome.completedWaves,
          createdAt: new Date(endedAt),
        })),
        skipDuplicates: true,
      });
    },
    byCode: async (code) => {
      const row = await tx.room.findUnique({ where: { code }, include });
      return row ? aggregate(row) : null;
    },
    byMatch: async (matchId) => {
      const row = await tx.room.findFirst({
        where: {
          matches: {
            some: { id: matchId, status: { in: ["PENDING", "ACTIVE"] } },
          },
        },
        include,
      });
      return row ? aggregate(row) : null;
    },
    staleMatches: async (now) =>
      (
        await tx.room.findMany({
          where: {
            status: { in: ["STARTING", "IN_MATCH"] },
            updatedAt: { lt: new Date(now - 45_000) },
          },
          include,
          take: 100,
        })
      )
        .map(aggregate)
        .filter((r) =>
          r.matchRuntime
            ? r.matchRuntime.leaseUntil <= now
            : r.updatedAt + 90_000 <= now,
        ),
    byCreationKey: async (creationKey) => {
      const row = await tx.room.findUnique({ where: { creationKey }, include });
      return row ? aggregate(row) : null;
    },
    forUser: async (userId) =>
      (
        await tx.room.findMany({
          where: {
            status: { in: ["WAITING", "STARTING", "IN_MATCH"] },
            members: { some: { userId, removedAt: null } },
          },
          include,
        })
      ).map(aggregate),
    publicRooms: async (slug) =>
      (
        await tx.room.findMany({
          where: { game: { slug }, visibility: "PUBLIC", status: "WAITING" },
          include,
          orderBy: { createdAt: "desc" },
          take: 100,
        })
      ).map(aggregate),
    game: (slug) => tx.game.findUnique({ where: { slug } }),
    save: async (room) => {
      const data = {
        hostUserId: room.hostUserId,
        status: room.status,
        stateVersion: room.stateVersion,
        updatedAt: new Date(room.updatedAt),
        commandReceipts: room.receipts as unknown as Prisma.InputJsonValue,
      };
      await tx.room.upsert({
        where: { id: room.id },
        create: {
          ...data,
          id: room.id,
          code: room.code,
          gameId: room.game.id,
          visibility: room.visibility,
          maxPlayers: room.maxPlayers,
          mode: room.mode === "solo" ? "SOLO" : "COOP",
          expiresAt: new Date(room.expiresAt),
          createdAt: new Date(room.createdAt),
          creationKey: room.creationKey,
        },
        update: data,
      });
      for (const member of room.members) {
        const data = {
          role: member.role,
          ready: member.ready,
          joinedAt: new Date(member.joinedAt),
          updatedAt: new Date(member.updatedAt),
          removedAt:
            member.removedAt === null ? null : new Date(member.removedAt),
          removalReason: member.removalReason,
        };
        await tx.roomMember.upsert({
          where: { roomId_userId: { roomId: room.id, userId: member.user.id } },
          create: { ...data, roomId: room.id, userId: member.user.id },
          update: data,
        });
      }
      await tx.match.updateMany({
        where: {
          roomId: room.id,
          status: { in: ["PENDING", "ACTIVE"] },
          ...(room.matchId ? { id: { not: room.matchId } } : {}),
        },
        data: { status: "ABORTED", endedAt: new Date(room.updatedAt) },
      });
      if (room.matchId)
        await tx.match.upsert({
          where: { id: room.matchId },
          create: {
            id: room.matchId,
            roomId: room.id,
            gameId: room.game.id,
            status: "PENDING",
          },
          update: {
            ...(room.matchRuntime
              ? {
                  gameplay:
                    room.matchRuntime as unknown as Prisma.InputJsonValue,
                  status: ["PLAYING", "RECONNECTING"].includes(
                    room.matchRuntime.state,
                  )
                    ? "ACTIVE"
                    : "PENDING",
                  ...(["PLAYING", "RECONNECTING"].includes(
                    room.matchRuntime.state,
                  )
                    ? {
                        startedAt: new Date(
                          room.matchRuntime.reservation.createdAt,
                        ),
                      }
                    : {}),
                }
              : {}),
          },
        });
    },
  };
}
export class PrismaRoomStateStore implements RoomStateStore {
  constructor(private client: PrismaClient = prisma) {}
  async transaction<T>(work: (tx: RoomTransaction) => Promise<T>): Promise<T> {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        return await this.client.$transaction(
          (tx) => work(transactionAdapter(tx)),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 10000,
          },
        );
      } catch (error) {
        // Retry secure-code collisions and concurrent membership/creation predicates.
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ["P2034", "P2002"].includes(error.code) &&
          attempt < 3
        )
          continue;
        throw error;
      }
    }
    throw new LobbyError("SERVICE_UNAVAILABLE");
  }
}
