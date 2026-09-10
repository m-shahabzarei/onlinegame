import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { getDevelopmentGame } from "@/server/catalog/catalog-data";

import { HomePage } from "./home-page";

afterEach(cleanup);

const nightfall = getDevelopmentGame("nightfall-protocol");

if (!nightfall) {
  throw new Error("The development catalog must include nightfall-protocol.");
}

describe("HomePage", () => {
  it("leads visitors through discovery and describes current room capabilities", () => {
    render(<HomePage featuredGames={[nightfall]} user={null} />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /make the next run count/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /explore games/i }),
    ).toHaveAttribute("href", "/games");
    expect(
      screen.getByRole("link", {
        name: /view nightfall protocol game details/i,
      }),
    ).toHaveAttribute("href", "/games/nightfall-protocol");
    expect(screen.queryByRole("button", { name: /create room/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /matchmaking/i })).toBeNull();

    const roadmap = screen
      .getByRole("heading", {
        level: 2,
        name: /your coordination layer/i,
      })
      .closest("section");
    expect(roadmap).not.toBeNull();
    expect(
      within(roadmap as HTMLElement).getByText("Private rooms"),
    ).toBeVisible();
    expect(within(roadmap as HTMLElement).queryByRole("button")).toBeNull();
  });

  it("provides a retry action when the catalog is empty", () => {
    render(<HomePage featuredGames={[]} user={null} />);

    expect(screen.getByText("The catalog is warming up")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Retry discovery" }),
    ).toHaveAttribute("href", "/");
  });
});
