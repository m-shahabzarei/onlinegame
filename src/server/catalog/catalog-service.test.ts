import { vi } from "vitest";

vi.mock("server-only", () => ({}));

import { describe, expect, it } from "vitest";

import { getDevelopmentGame } from "./catalog-data";
import { catalogGameFromRecord } from "./catalog-service";

describe("development catalog", () => {
  it("contains the stable first-game slug", () => {
    const game = getDevelopmentGame("nightfall-protocol");

    expect(game).toBeDefined();
    expect(game?.name).toBe("Nightfall Protocol");
    expect(game?.maxPlayers).toBe(2);
    expect(game?.status).toBe("AVAILABLE");
    expect(game?.features.length).toBeGreaterThan(0);
  });

  it("returns undefined for an unknown details slug", () => {
    expect(getDevelopmentGame("missing-brief")).toBeUndefined();
  });
});

describe("catalogGameFromRecord", () => {
  const record = {
    id: "persisted-nightfall",
    slug: "nightfall-protocol",
    name: "Nightfall Protocol",
    description: "Persisted description",
    status: "ACTIVE",
    maxPlayers: 2,
    thumbnailUrl: null,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-02T00:00:00.000Z"),
  };

  it("maps database status and preserves presentation metadata", () => {
    const game = catalogGameFromRecord(record);

    expect(game).toMatchObject({
      id: "persisted-nightfall",
      status: "AVAILABLE",
      durationMinutes: 30,
      difficulty: "TACTICAL",
      tags: ["Co-op", "First-person", "Zombie survival"],
    });
  });

  it("does not expose archived games", () => {
    expect(
      catalogGameFromRecord({ ...record, status: "ARCHIVED" }),
    ).toBeUndefined();
  });
});
