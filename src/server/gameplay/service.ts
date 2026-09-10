import "server-only";
import { randomUUID } from "node:crypto";
import { activeMembers, type RoomAggregate } from "@/domain/lobby";
import type { AuthSession } from "@/domain/auth";
import { LIMITS } from "@/game/shared/config";
import { terminalState } from "@/game/shared/lifecycle";
import { GameError, type Reservation } from "@/game/shared/protocol";
import {
  signToken,
  tokenTimes,
  type lifecycleClaimsSchema,
} from "@/game/shared/tokens";
import type { z } from "zod";
import { getFeatureFlags } from "@/config/feature-flags";
import type { RoomStateStore } from "@/server/lobby/store";
export interface Provisioner {
  epoch(): Promise<string>;
  reserve(reservation: Reservation): Promise<void>;
  cancel(reservation: Reservation): Promise<void>;
}
function closeRoom(room: RoomAggregate, now: number) {
  room.status = "CLOSED";
  room.matchId = null;
  delete room.matchRuntime;
  room.updatedAt = now;
  room.stateVersion++;
  for (const member of room.members) member.ready = false;
}
export class GameplayBootstrapService {
  constructor(
    readonly store: RoomStateStore,
    readonly provisioner: Provisioner,
    readonly joinSecret: string,
    readonly wsUrl: string,
    readonly now = Date.now,
  ) {}
  async authorize(userId: string, matchId: string) {
    const room = await this.store.transaction((tx) => tx.byMatch(matchId));
    if (
      !room ||
      room.matchId !== matchId ||
      !activeMembers(room).some((m) => m.user.id === userId)
    )
      throw new GameError("UNAUTHORIZED");
    return room;
  }
  async bootstrap(session: AuthSession, matchId: string) {
    const flags = getFeatureFlags();
    if (flags.maintenance || !flags.gameAvailable)
      throw new GameError("MATCH_UNAVAILABLE");
    if (
      +session.expiresAt <= this.now() ||
      (session.kind === "GUEST") !== session.user.isGuest
    )
      throw new GameError("UNAUTHORIZED");
    await this.authorize(session.userId, matchId);
    const serverEpoch = await this.provisioner.epoch();
    const reservation = await this.store.transaction(async (tx) => {
      const room = await tx.byMatch(matchId);
      if (
        !room ||
        room.matchId !== matchId ||
        !activeMembers(room).some((m) => m.user.id === session.userId)
      )
        throw new GameError("UNAUTHORIZED");
      if (
        room.expiresAt <= this.now() ||
        (room.matchRuntime &&
          (room.matchRuntime.leaseUntil <= this.now() ||
            room.matchRuntime.reservation.serverEpoch !== serverEpoch)) ||
        (!room.matchRuntime && room.updatedAt + 90000 <= this.now())
      ) {
        closeRoom(room, this.now());
        await tx.save(room);
        return null;
      }
      if (
        !["STARTING", "IN_MATCH"].includes(room.status) ||
        activeMembers(room).length !== (room.mode === "solo" ? 1 : 2)
      )
        throw new GameError("MATCH_UNAVAILABLE");
      if (!room.matchRuntime) {
        const members = activeMembers(room).sort((a, b) =>
          a.role === b.role
            ? a.user.id.localeCompare(b.user.id)
            : a.role === "HOST"
              ? -1
              : 1,
        );
        const players = members.map((m, slot) => ({
          userId: m.user.id,
          playerId: randomUUID(),
          name: m.user.displayName,
          kind: m.user.isGuest ? ("GUEST" as const) : ("USER" as const),
          slot: slot as 0 | 1,
        }));
        room.matchRuntime = {
          reservation: {
            matchId,
            roomId: room.id,
            runtimeId: randomUUID(),
            serverEpoch,
            createdAt: this.now(),
            ...(room.mode === "solo"
              ? {
                  mode: "solo" as const,
                  players: [players[0]!] as [(typeof players)[number]],
                }
              : {
                  mode: "coop" as const,
                  players: [players[0]!, players[1]!] as [
                    (typeof players)[number],
                    (typeof players)[number],
                  ],
                }),
          },
          state: "WAITING_FOR_PLAYERS",
          leaseUntil: this.now() + LIMITS.leaseMs,
          observedAt: this.now(),
        };
        room.status = "IN_MATCH";
        room.updatedAt = this.now();
        room.stateVersion++;
        await tx.save(room);
      }
      return room.matchRuntime.reservation;
    });
    if (!reservation) throw new GameError("MATCH_UNAVAILABLE");
    try {
      await this.provisioner.reserve(reservation);
    } catch {
      await this.abort(matchId, reservation.runtimeId);
      throw new GameError("SERVER_UNAVAILABLE");
    }
    // Recheck after provisioning: cancellation or another request may have ended the match.
    const room = await this.authorize(session.userId, matchId);
    if (room.matchRuntime?.reservation.runtimeId !== reservation.runtimeId)
      throw new GameError("MATCH_UNAVAILABLE");
    const player = reservation.players.find(
      (p) => p.userId === session.userId && p.kind === session.kind,
    );
    if (!player) throw new GameError("UNAUTHORIZED");
    const times = tokenTimes(
      this.now(),
      Math.min(LIMITS.ticketMs, +session.expiresAt - this.now()),
    );
    const token = signToken(
      {
        ...times,
        aud: "twoplayer-gameplay",
        ...player,
        matchId,
        roomId: reservation.roomId,
        runtimeId: reservation.runtimeId,
      },
      this.joinSecret,
    );
    return {
      token,
      wsUrl: this.wsUrl,
      expiresAt: times.exp,
      returnPath: "/games/nightfall-protocol/rooms",
    };
  }
  async lifecycle(claims: z.infer<typeof lifecycleClaimsSchema>) {
    await this.store.transaction(async (tx) => {
      const room = await tx.byMatch(claims.matchId);
      if (!room) return; // Terminal callbacks are idempotent.
      const runtime = room.matchRuntime;
      if (!runtime || runtime.reservation.runtimeId !== claims.runtimeId)
        throw new GameError("UNAUTHORIZED");
      if (runtime.leaseUntil <= this.now()) {
        closeRoom(room, this.now());
        await tx.save(room);
        return;
      }
      if (claims.iat <= runtime.observedAt) return;
      if (terminalState(claims.state)) {
        if (claims.state === "ENDED" && claims.outcome)
          await tx.recordOutcome(claims.matchId, claims.outcome, this.now());
        closeRoom(room, this.now());
      } else {
        runtime.state = claims.state;
        runtime.leaseUntil = this.now() + LIMITS.leaseMs;
        runtime.observedAt = claims.iat;
        room.updatedAt = this.now();
      }
      await tx.save(room);
    });
  }
  async abort(matchId: string, runtimeId: string) {
    await this.store.transaction(async (tx) => {
      const room = await tx.byMatch(matchId);
      if (room?.matchRuntime?.reservation.runtimeId === runtimeId) {
        closeRoom(room, this.now());
        await tx.save(room);
      }
    });
  }
  async leave(userId: string, matchId: string) {
    const reservation = await this.store.transaction(async (tx) => {
      const room = await tx.byMatch(matchId);
      if (!room) return null;
      if (!activeMembers(room).some((m) => m.user.id === userId))
        throw new GameError("UNAUTHORIZED");
      const reservation = room.matchRuntime?.reservation ?? null;
      closeRoom(room, this.now());
      await tx.save(room);
      return reservation;
    });
    if (reservation) await this.provisioner.cancel(reservation).catch(() => {}); // Expiring lease remains the crash-safe cleanup.
  }
  async sweep() {
    return this.store.transaction(async (tx) => {
      const stale = await tx.staleMatches(this.now());
      for (const room of stale) {
        closeRoom(room, this.now());
        await tx.save(room);
      }
      return stale.length;
    });
  }
}
