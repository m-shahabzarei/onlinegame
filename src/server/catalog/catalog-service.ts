import "server-only";

import { unstable_cache } from "next/cache";

import { type CatalogGame, mapGameStatus } from "@/domain/catalog";
import type { GameStatus } from "@/domain/game";
import { prisma } from "@/db/client";

import { DEVELOPMENT_CATALOG, getDevelopmentGame } from "./catalog-data";

/** The catalog is mostly static; persisted rows are refreshed at most every five minutes. */
export const CATALOG_REVALIDATE_SECONDS = 300;

export interface CatalogGameRecord {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  maxPlayers: number;
  thumbnailUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

function isGameStatus(value: string): value is GameStatus {
  return (
    value === "DRAFT" ||
    value === "ACTIVE" ||
    value === "MAINTENANCE" ||
    value === "ARCHIVED"
  );
}

/**
 * Map the intentionally small persisted Game model into the richer public
 * catalog DTO. Optional presentation metadata comes from a matching
 * deterministic entry until the database model grows those fields.
 */
export function catalogGameFromRecord(
  record: CatalogGameRecord,
): CatalogGame | undefined {
  const status = mapGameStatus(
    isGameStatus(record.status) ? record.status : "DRAFT",
  );

  if (!status) {
    return undefined;
  }

  const template = getDevelopmentGame(record.slug);

  return {
    id: record.id,
    slug: record.slug,
    name: record.name,
    description: record.description,
    status,
    maxPlayers: record.maxPlayers,
    thumbnailUrl: record.thumbnailUrl,
    durationMinutes: template?.durationMinutes ?? 30,
    difficulty: template?.difficulty ?? "TACTICAL",
    genre: template?.genre ?? "Cooperative experience",
    tags: template?.tags ?? ["Co-op"],
    overview: template?.overview ?? record.description,
    features: template?.features ?? ["Cooperative sessions (planned)"],
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function readPersistedGames(): Promise<readonly CatalogGameRecord[]> {
  const rows = await prisma.game.findMany({
    where: { status: { not: "ARCHIVED" } },
    orderBy: { updatedAt: "desc" },
  });

  return rows;
}

const readPersistedGamesCached = unstable_cache(
  readPersistedGames,
  ["twoplayer-catalog-games"],
  { revalidate: CATALOG_REVALIDATE_SECONDS },
);

/**
 * Read catalog entries from PostgreSQL when configured. A deterministic,
 * clearly non-live catalog keeps local development and preview deployments
 * usable before the database has been seeded.
 */
export async function getCatalogGames(): Promise<readonly CatalogGame[]> {
  const productionRuntime = process.env.NODE_ENV === "production";

  if (!process.env.DATABASE_URL?.trim()) {
    if (productionRuntime) {
      throw new Error("Catalog database configuration is unavailable.");
    }

    return DEVELOPMENT_CATALOG;
  }

  try {
    const rows = await readPersistedGamesCached();
    const games = rows
      .map((row) => catalogGameFromRecord(row))
      .filter((game): game is CatalogGame => game !== undefined);

    if (games.length > 0) {
      return games;
    }

    return productionRuntime ? [] : DEVELOPMENT_CATALOG;
  } catch (error) {
    if (productionRuntime) {
      throw error;
    }

    // A missing/unreachable local database should not make the public catalog
    // unusable. Production observability can capture this warning without
    // leaking connection strings or implementation details to the browser.
    console.warn(
      "TwoPlayer catalog database read failed; using development catalog.",
      error,
    );
    return DEVELOPMENT_CATALOG;
  }
}

export async function getCatalogGame(
  slug: string,
): Promise<CatalogGame | undefined> {
  const normalizedSlug = slug.trim().toLowerCase();

  if (!normalizedSlug) {
    return undefined;
  }

  const games = await getCatalogGames();
  return games.find((game) => game.slug === normalizedSlug);
}
