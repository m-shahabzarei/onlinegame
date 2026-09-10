import { beforeEach, describe, expect, it, vi } from "vitest";

const routeMocks = vi.hoisted(() => ({
  getCatalogGame: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/server/catalog", () => ({
  DEVELOPMENT_CATALOG: [],
  getCatalogGame: routeMocks.getCatalogGame,
}));

vi.mock("next/navigation", () => ({
  notFound: routeMocks.notFound,
}));

import GameDetailsPage from "./page";

describe("GameDetailsPage", () => {
  beforeEach(() => {
    routeMocks.getCatalogGame.mockReset();
    routeMocks.notFound.mockClear();
  });

  it("delegates an unknown slug to the route not-found boundary", async () => {
    routeMocks.getCatalogGame.mockResolvedValue(undefined);

    await expect(
      GameDetailsPage({ params: Promise.resolve({ slug: "missing-game" }) }),
    ).rejects.toThrow("NEXT_NOT_FOUND");

    expect(routeMocks.getCatalogGame).toHaveBeenCalledWith("missing-game");
    expect(routeMocks.notFound).toHaveBeenCalledOnce();
  });
});
