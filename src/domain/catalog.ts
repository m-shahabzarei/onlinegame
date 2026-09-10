import type { GameStatus } from "./game";

/**
 * The status vocabulary exposed to the public catalog. Database game rows use
 * the lower-level `GameStatus` enum; the catalog deliberately uses language
 * that is understandable to players and does not imply that a room or match
 * is available.
 */
export const CATALOG_GAME_STATUSES = [
  "AVAILABLE",
  "COMING_SOON",
  "MAINTENANCE",
] as const;

export type CatalogGameStatus = (typeof CATALOG_GAME_STATUSES)[number];

export const CATALOG_DIFFICULTIES = ["RECRUIT", "TACTICAL", "VETERAN"] as const;

export type CatalogDifficulty = (typeof CATALOG_DIFFICULTIES)[number];

export interface CatalogGame {
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string;
  readonly status: CatalogGameStatus;
  readonly maxPlayers: number;
  readonly thumbnailUrl: string | null;
  readonly durationMinutes: number;
  readonly difficulty: CatalogDifficulty;
  readonly genre: string;
  readonly tags: readonly string[];
  readonly overview: string;
  readonly features: readonly string[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export function mapGameStatus(status: GameStatus): CatalogGameStatus | null {
  switch (status) {
    case "ACTIVE":
      return "AVAILABLE";
    case "DRAFT":
      return "COMING_SOON";
    case "MAINTENANCE":
      return "MAINTENANCE";
    case "ARCHIVED":
      return null;
  }
}

export function catalogStatusLabel(status: CatalogGameStatus): string {
  switch (status) {
    case "AVAILABLE":
      return "Available";
    case "COMING_SOON":
      return "Coming soon";
    case "MAINTENANCE":
      return "Maintenance";
  }
}

export function catalogDifficultyLabel(difficulty: CatalogDifficulty): string {
  switch (difficulty) {
    case "RECRUIT":
      return "Recruit";
    case "TACTICAL":
      return "Tactical";
    case "VETERAN":
      return "Veteran";
  }
}
