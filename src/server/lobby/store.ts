import type { LobbyGame, RoomAggregate } from "@/domain/lobby";
import type { PvEOutcome } from "@/game/shared/pve";

export interface RoomTransaction {
  byCode(code: string): Promise<RoomAggregate | null>;
  byMatch(matchId: string): Promise<RoomAggregate | null>;
  staleMatches(now: number): Promise<RoomAggregate[]>;
  byCreationKey(key: string): Promise<RoomAggregate | null>;
  forUser(userId: string): Promise<RoomAggregate[]>;
  publicRooms(slug: string): Promise<RoomAggregate[]>;
  game(slug: string): Promise<LobbyGame | null>;
  save(room: RoomAggregate): Promise<void>;
  recordOutcome(
    matchId: string,
    outcome: PvEOutcome,
    endedAt: number,
  ): Promise<void>;
}
/** All callbacks are atomic. Implementations must retry serialization conflicts. */
export interface RoomStateStore {
  transaction<T>(work: (tx: RoomTransaction) => Promise<T>): Promise<T>;
}

/** One process only. Explicitly disabled in production by composition. */
export class LocalRoomStateStore implements RoomStateStore {
  rooms = new Map<string, RoomAggregate>();
  outcomes = new Map<string, PvEOutcome>();
  games = new Map<string, LobbyGame>([
    [
      "nightfall-protocol",
      {
        id: "game-nightfall-protocol",
        slug: "nightfall-protocol",
        name: "Nightfall Protocol",
        description:
          "Prepare a two-player cooperative session. Gameplay arrives in Phase 4.",
        status: "ACTIVE",
        maxPlayers: 2,
      },
    ],
  ]);
  private queue: Promise<unknown> = Promise.resolve();
  transaction<T>(work: (tx: RoomTransaction) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const draft = new Map(
        [...this.rooms].map(([key, value]) => [key, structuredClone(value)]),
      );
      const outcomes = new Map(this.outcomes);
      const tx: RoomTransaction = {
        recordOutcome: async (matchId, outcome) => {
          if (!outcomes.has(matchId))
            outcomes.set(matchId, structuredClone(outcome));
        },
        byCode: async (code) => draft.get(code) ?? null,
        byMatch: async (id) =>
          [...draft.values()].find((r) => r.matchId === id) ?? null,
        staleMatches: async (now) =>
          [...draft.values()].filter(
            (r) =>
              !!r.matchId &&
              (r.matchRuntime
                ? r.matchRuntime.leaseUntil <= now
                : r.status === "STARTING" && r.updatedAt + 90_000 <= now),
          ),
        byCreationKey: async (key) =>
          [...draft.values()].find((r) => r.creationKey === key) ?? null,
        forUser: async (id) =>
          [...draft.values()].filter(
            (r) =>
              ["WAITING", "STARTING", "IN_MATCH"].includes(r.status) &&
              r.members.some((m) => m.user.id === id && m.removedAt === null),
          ),
        publicRooms: async (slug) =>
          [...draft.values()]
            .filter(
              (r) =>
                r.game.slug === slug &&
                r.visibility === "PUBLIC" &&
                r.status === "WAITING",
            )
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, 100),
        game: async (slug) => this.games.get(slug) ?? null,
        save: async (room) => {
          draft.set(room.code, structuredClone(room));
        },
      };
      const result = await work(tx);
      this.rooms = draft;
      this.outcomes = outcomes;
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}
