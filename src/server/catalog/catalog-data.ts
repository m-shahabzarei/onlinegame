import type { CatalogGame } from "@/domain/catalog";

const CATALOG_SEED_DATE = "2026-01-15T00:00:00.000Z";

function seedDate(): Date {
  return new Date(CATALOG_SEED_DATE);
}

/**
 * Deterministic entries keep the public catalog useful before a database has
 * been seeded. They intentionally describe product previews, not live rooms,
 * online counts, or match state.
 */
export const DEVELOPMENT_CATALOG = [
  {
    id: "game-nightfall-protocol",
    slug: "nightfall-protocol",
    name: "Nightfall Protocol",
    description:
      "A cinematic two-player cooperative first-person zombie survival shooter built around trust, timing, and team progression.",
    status: "AVAILABLE",
    maxPlayers: 2,
    thumbnailUrl: null,
    durationMinutes: 30,
    difficulty: "TACTICAL",
    genre: "Co-op zombie survival shooter",
    tags: ["Co-op", "First-person", "Zombie survival"],
    overview:
      "Hold the line together through escalating zombie waves, coordinate weapon roles, and prepare for team upgrades and boss encounters. Room preparation is available now; actual gameplay arrives in Phase 4.",
    features: [
      "Two-player team progression",
      "Escalating zombie waves (planned)",
      "Weapons and team upgrades (planned)",
      "Boss encounters (planned)",
    ],
    createdAt: seedDate(),
    updatedAt: seedDate(),
  },
  {
    id: "game-signal-wardens",
    slug: "signal-wardens",
    name: "Signal Wardens",
    description:
      "A tactical co-op concept about reading the field, sharing resources, and making the next call together.",
    status: "AVAILABLE",
    maxPlayers: 2,
    thumbnailUrl: null,
    durationMinutes: 20,
    difficulty: "RECRUIT",
    genre: "Co-op tactics",
    tags: ["Co-op", "Tactical", "Preview"],
    overview:
      "Explore the design direction for a compact two-player mission format. This catalog preview is available to browse; multiplayer sessions are not available in Phase 2.",
    features: [
      "Shared objective planning",
      "Readable tactical roles",
      "Session preparation flow (planned)",
    ],
    createdAt: seedDate(),
    updatedAt: seedDate(),
  },
  {
    id: "game-emberline",
    slug: "emberline",
    name: "Emberline",
    description:
      "A high-pressure four-player cooperative concept currently receiving a systems pass.",
    status: "MAINTENANCE",
    maxPlayers: 4,
    thumbnailUrl: null,
    durationMinutes: 35,
    difficulty: "VETERAN",
    genre: "Co-op action",
    tags: ["Co-op", "Squad", "In development"],
    overview:
      "Emberline is temporarily unavailable while the team refines its cooperative foundation. Check back later for a new product brief.",
    features: [
      "Four-player-ready room design",
      "Team role experiments",
      "Progression framework (planned)",
    ],
    createdAt: seedDate(),
    updatedAt: seedDate(),
  },
] satisfies readonly CatalogGame[];

export function getDevelopmentGame(slug: string): CatalogGame | undefined {
  return DEVELOPMENT_CATALOG.find((game) => game.slug === slug);
}
