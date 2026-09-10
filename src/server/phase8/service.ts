import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/db/client";
import {
  CHALLENGES,
  COSMETICS,
  advanceChallengeProgress,
} from "@/domain/phase8";
import { track } from "@/server/analytics/events";

const historyLimit = z.coerce.number().int().min(1).max(50).default(20);
const reportSchema = z
  .object({
    targetUserId: z.string().min(1).max(128),
    matchId: z.string().min(1).max(128).optional(),
    reason: z.enum(["ABUSE", "CHEATING", "HARASSMENT", "EXPLOIT", "OTHER"]),
    details: z.string().trim().max(500).optional(),
  })
  .strict();

export class Phase8Service {
  private async analyticsOptedOut(userId: string) {
    return Boolean(
      (
        await prisma.user.findUnique({
          where: { id: userId },
          select: { analyticsOptOut: true },
        })
      )?.analyticsOptOut,
    );
  }
  async history(
    userId: string,
    input: { cursor?: string; limit?: number } = {},
  ) {
    const limit = historyLimit.parse(input.limit);
    const rows = await prisma.matchHistory.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      ...(input.cursor ? { skip: 1, cursor: { id: input.cursor } } : {}),
      include: {
        match: { include: { game: { select: { slug: true, name: true } } } },
      },
    });
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    return {
      items: page.map((row) => ({
        id: row.id,
        matchId: row.matchId,
        game: row.match.game,
        result: row.result,
        completedWaves: row.completedWaves,
        score: row.score,
        contribution: row.contribution,
        kills: row.kills,
        damage: row.damage,
        revives: row.revives,
        objectives: row.objectives,
        durationSeconds: row.durationSeconds,
        reconnected: row.reconnected,
        createdAt: row.createdAt,
      })),
      nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
    };
  }

  async profileSummary(userId: string) {
    const [count, completed, wins, latest, cosmetics, challengeProgress] =
      await Promise.all([
        prisma.matchHistory.count({ where: { userId } }),
        prisma.matchHistory.count({
          where: { userId, result: { in: ["VICTORY", "PHASE_COMPLETE"] } },
        }),
        prisma.matchHistory.count({ where: { userId, result: "VICTORY" } }),
        prisma.matchHistory.findFirst({
          where: { userId },
          orderBy: { createdAt: "desc" },
        }),
        prisma.userCosmetic.findMany({
          where: { userId },
          include: { cosmetic: true },
        }),
        prisma.challengeProgress.findMany({
          where: { userId },
          select: { challengeId: true, progress: true, completedAt: true },
        }),
      ]);
    return {
      gamesPlayed: count,
      matchesCompleted: completed,
      wins,
      defeats: Math.max(0, completed - wins),
      recent: latest
        ? {
            result: latest.result,
            score: latest.score,
            createdAt: latest.createdAt,
          }
        : null,
      cosmetics: cosmetics
        .filter((entry) => entry.cosmetic.enabled)
        .map((entry) => ({
          id: entry.cosmeticId,
          kind: entry.cosmetic.kind,
          displayName: entry.cosmetic.displayName,
          equipped: Boolean(entry.equippedAt),
        })),
      challenges: challengeProgress,
    };
  }

  async challenges(userId: string, now = new Date()) {
    const active = CHALLENGES.map((definition) => ({
      ...definition,
      startsAt: now,
      endsAt: now,
    }));
    const progress = await prisma.challengeProgress.findMany({
      where: { userId, challengeId: { in: active.map((item) => item.id) } },
    });
    const byId = new Map(progress.map((item) => [item.challengeId, item]));
    return active.map((definition) => ({
      ...definition,
      progress: byId.get(definition.id)?.progress ?? 0,
      completedAt: byId.get(definition.id)?.completedAt ?? null,
    }));
  }

  async recordChallengeEvent(
    userId: string,
    unit: (typeof CHALLENGES)[number]["unit"],
    delta: number,
    now = new Date(),
  ) {
    const definitions = CHALLENGES.filter(
      (definition) => definition.unit === unit,
    );
    for (const definition of definitions) {
      await prisma.$transaction(async (tx) => {
        await tx.challengeDefinition.upsert({
          where: { id: definition.id },
          create: {
            ...definition,
            startsAt: now,
            endsAt: new Date(
              now.getTime() +
                (definition.cadence === "DAILY" ? 86_400_000 : 604_800_000),
            ),
          },
          update: {},
        });
        const existing = await tx.challengeProgress.findUnique({
          where: { challengeId_userId: { challengeId: definition.id, userId } },
        });
        if (existing?.completedAt) return;
        const next = advanceChallengeProgress(
          existing?.progress ?? 0,
          delta,
          definition.target,
          now,
        );
        await tx.challengeProgress.upsert({
          where: { challengeId_userId: { challengeId: definition.id, userId } },
          create: {
            id: randomUUID(),
            challengeId: definition.id,
            userId,
            progress: next.progress,
            completedAt: next.completedAt,
            rewardGrantedAt: next.completed ? now : null,
          },
          update: {
            progress: next.progress,
            ...(next.completed
              ? { completedAt: next.completedAt, rewardGrantedAt: now }
              : {}),
          },
        });
      });
    }
  }

  async cosmetics(userId: string) {
    await prisma.$transaction(async (tx) => {
      for (const definition of COSMETICS) {
        await tx.cosmeticDefinition.upsert({
          where: { id: definition.id },
          create: definition,
          update: {
            version: definition.version,
            displayName: definition.displayName,
            assetKey: definition.assetKey,
            enabled: definition.enabled,
          },
        });
      }
      await tx.userCosmetic.upsert({
        where: {
          userId_cosmeticId: { userId, cosmeticId: "badge-first-light" },
        },
        create: { userId, cosmeticId: "badge-first-light" },
        update: {},
      });
    });
    const owned = await prisma.userCosmetic.findMany({
      where: { userId },
      include: { cosmetic: true },
    });
    return COSMETICS.map((definition) => ({
      ...definition,
      owned: owned.some((item) => item.cosmeticId === definition.id),
      equipped: Boolean(
        owned.find((item) => item.cosmeticId === definition.id)?.equippedAt,
      ),
    }));
  }

  async equipCosmetic(userId: string, cosmeticId: string) {
    const definition = COSMETICS.find(
      (item) => item.id === cosmeticId && item.enabled,
    );
    if (!definition) throw new Error("COSMETIC_UNAVAILABLE");
    return prisma.$transaction(async (tx) => {
      const owned = await tx.userCosmetic.findUnique({
        where: { userId_cosmeticId: { userId, cosmeticId } },
      });
      if (!owned) throw new Error("COSMETIC_NOT_OWNED");
      await tx.userCosmetic.updateMany({
        where: { userId, cosmetic: { kind: definition.kind } },
        data: { equippedAt: null },
      });
      return tx.userCosmetic.update({
        where: { userId_cosmeticId: { userId, cosmeticId } },
        data: { equippedAt: new Date() },
        include: { cosmetic: true },
      });
    });
  }

  async report(reporterId: string, input: unknown) {
    const data = reportSchema.parse(input);
    if (data.targetUserId === reporterId) throw new Error("SELF_REPORT");
    const recent = await prisma.safetyReport.count({
      where: {
        reporterId,
        targetUserId: data.targetUserId,
        createdAt: { gte: new Date(Date.now() - 86_400_000) },
      },
    });
    if (recent >= 3) throw new Error("REPORT_RATE_LIMITED");
    const report = await prisma.safetyReport.create({
      data: {
        id: randomUUID(),
        reporterId,
        targetUserId: data.targetUserId,
        matchId: data.matchId ?? null,
        reason: data.reason,
        details: data.details || null,
      },
    });
    track(
      {
        name: "report_submitted",
        version: 1,
        userId: reporterId,
        ...(data.matchId ? { matchId: data.matchId } : {}),
        properties: { reason: data.reason },
      },
      await this.analyticsOptedOut(reporterId),
    );
    return report;
  }

  async setBlock(blockerId: string, blockedId: string, blocked: boolean) {
    if (blockerId === blockedId) throw new Error("SELF_BLOCK");
    if (blocked)
      return prisma.userBlock.upsert({
        where: { blockerId_blockedId: { blockerId, blockedId } },
        create: { blockerId, blockedId },
        update: {},
      });
    await prisma.userBlock.deleteMany({ where: { blockerId, blockedId } });
  }
}

export const phase8Service = new Phase8Service();
