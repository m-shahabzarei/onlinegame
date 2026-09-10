import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/domain/auth";

import { MobileNav } from "./mobile-nav";

let pathname = "/games";
const replace = vi.fn();
const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ replace, refresh }),
}));

afterEach(() => {
  cleanup();
  replace.mockReset();
  refresh.mockReset();
  pathname = "/games";
  vi.unstubAllGlobals();
});

const user: SafeUser = {
  id: "user_1",
  username: "nightwatch",
  displayName: "Night Watch",
  avatarUrl: null,
  email: "nightwatch@example.com",
  isGuest: false,
  bio: null,
  locale: "en",
  reducedMotion: false,
  soundEnabled: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

describe("MobileNav", () => {
  it("shows public account choices to signed-out visitors", () => {
    render(<MobileNav user={null} />);

    expect(screen.getByRole("link", { name: "Games" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Log in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("link", { name: "Create account" }),
    ).toHaveAttribute("href", "/register");
    expect(screen.getByRole("link", { name: "Guest" })).toHaveAttribute(
      "href",
      "/continue-as-guest",
    );
    expect(screen.queryByRole("link", { name: "Profile" })).toBeNull();
  });

  it("shows account navigation without stale signed-out actions", () => {
    render(<MobileNav user={user} />);

    expect(screen.getByRole("link", { name: "Profile" })).toHaveAttribute(
      "href",
      "/profile",
    );
    expect(screen.getByRole("link", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings",
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
    expect(screen.queryByRole("link", { name: "Log in" })).toBeNull();
  });

  it("exposes guest continuation in the accessible mobile menu", () => {
    render(<MobileNav user={null} />);

    const trigger = screen.getByRole("button", { name: "Open navigation" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);

    expect(
      screen.getByRole("button", { name: "Close navigation" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("link", { name: "Continue as guest" }),
    ).toHaveAttribute("href", "/continue-as-guest");
  });

  it("labels guest sessions and closes the mobile menu with Escape", () => {
    render(
      <MobileNav user={{ ...user, isGuest: true, displayName: "Guest" }} />,
    );

    expect(screen.getByText("Guest")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    expect(screen.getByText("Temporary identity")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByText("Temporary identity")).toBeNull();
    expect(
      screen.getByRole("button", { name: "Open navigation" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("announces the active authenticated route in the mobile menu", () => {
    pathname = "/profile";
    render(<MobileNav user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));

    const profileLinks = screen.getAllByRole("link", { name: "Profile" });
    expect(profileLinks).toHaveLength(2);
    expect(profileLinks[1]).toHaveAttribute("aria-current", "page");
    expect(
      screen.getAllByRole("link", { name: "Settings" })[1],
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps the authenticated UI recoverable when sign out cannot reach the server", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<MobileNav user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert", { name: "" })).toHaveTextContent(
      /did not reach twoplayer/i,
    );
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the authenticated UI recoverable when session revocation is unavailable", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 503 })),
    );
    render(<MobileNav user={user} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /check your connection and retry/i,
    );
    expect(replace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
