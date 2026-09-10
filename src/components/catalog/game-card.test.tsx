import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { getDevelopmentGame } from "@/server/catalog/catalog-data";

import { CatalogEmptyState, CatalogErrorState } from "./catalog-states";
import { GameArt } from "./game-art";
import { GameCard } from "./game-card";

afterEach(cleanup);

const game = getDevelopmentGame("nightfall-protocol");

if (!game) {
  throw new Error("The development catalog must include nightfall-protocol.");
}

describe("GameCard", () => {
  it("exposes a stable accessible details link and catalog metadata", () => {
    render(<GameCard game={game} />);

    expect(
      screen.getByRole("link", {
        name: /view nightfall protocol game details/i,
      }),
    ).toHaveAttribute("href", "/games/nightfall-protocol");
    expect(screen.getAllByText("Available")).toHaveLength(2);
    expect(screen.getByText("2 players")).toBeInTheDocument();
    expect(screen.getByText("30 min")).toBeInTheDocument();
    expect(screen.getByText("Tactical")).toBeInTheDocument();
  });
});

describe("GameArt", () => {
  it("shows a recovery label when a supplied cover image fails", () => {
    const thumbnail = "https://cdn.example.invalid/nightfall.webp";
    const { container } = render(
      <GameArt game={{ ...game, thumbnailUrl: thumbnail }} />,
    );

    const image = container.querySelector("img");
    expect(image).not.toBeNull();
    fireEvent.error(image as HTMLImageElement);

    expect(screen.getByText("Art unavailable")).toBeInTheDocument();
  });
});

describe("catalog states", () => {
  it("explains an empty catalog and offers recovery navigation", () => {
    render(<CatalogEmptyState />);

    expect(screen.getByText("The catalog is quiet")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /retry catalog/i }),
    ).toHaveAttribute("href", "/games");
  });

  it("supports retrying a catalog error", () => {
    const onRetry = vi.fn();
    render(<CatalogErrorState onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
    expect(screen.getByRole("alert")).toHaveTextContent(/catalog signal lost/i);
  });
});
