import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Link from "next/link";

import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";

function WarningProbe({ dirty = true }: { dirty?: boolean }) {
  useUnsavedChangesWarning(dirty);
  return null;
}

describe("useUnsavedChangesWarning", () => {
  beforeEach(() => {
    window.history.replaceState({}, "", "/profile");
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    window.history.replaceState({}, "", "/");
  });

  it("restores the guard when browser history navigation is declined", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    const pushState = vi.spyOn(window.history, "pushState");

    render(<WarningProbe />);
    expect(pushState).toHaveBeenCalledTimes(1);

    // Browser Back has moved from the same-URL guard to the original entry.
    window.history.replaceState({}, "", "/profile");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(confirm).toHaveBeenCalledOnce();
    expect(pushState).toHaveBeenCalledTimes(2);
    expect(window.location.pathname).toBe("/profile");
  });

  it("continues browser history navigation after confirmation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    render(<WarningProbe />);
    window.history.replaceState({}, "", "/profile");
    window.dispatchEvent(new PopStateEvent("popstate"));

    expect(back).toHaveBeenCalledOnce();
  });

  it("removes the same-URL guard before a confirmed link navigation", () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const back = vi.spyOn(window.history, "back").mockImplementation(() => {});

    render(
      <>
        <WarningProbe />
        <Link href="/games">Browse games</Link>
      </>,
    );

    expect(fireEvent.click(screen.getByRole("link"))).toBe(false);
    expect(back).toHaveBeenCalledOnce();
  });
});
