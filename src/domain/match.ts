import type { GameId } from "./game";
import type { RoomId } from "./room";

export type MatchId = string;

export const MATCH_STATUSES = [
  "PENDING",
  "ACTIVE",
  "COMPLETED",
  "ABORTED",
] as const;

export type MatchStatus = (typeof MATCH_STATUSES)[number];

export interface Match {
  readonly id: MatchId;
  readonly gameId: GameId;
  readonly roomId: RoomId;
  readonly status: MatchStatus;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
