export type GameId = string;

export const GAME_STATUSES = [
  "DRAFT",
  "ACTIVE",
  "MAINTENANCE",
  "ARCHIVED",
] as const;

export type GameStatus = (typeof GAME_STATUSES)[number];

export interface Game {
  readonly id: GameId;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly status: GameStatus;
  readonly maxPlayers: number;
  readonly thumbnailUrl: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
