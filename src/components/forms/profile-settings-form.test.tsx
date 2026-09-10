import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import Link from "next/link";

import { ProfileForm, SettingsForm } from "./index";

const action = async () => ({ ok: false as const });

afterEach(cleanup);

describe("ProfileForm", () => {
  it("renders profile fields and preserves a useful avatar fallback", () => {
    render(
      <ProfileForm
        action={action}
        user={{
          username: "night_runner",
          displayName: "Night Runner",
          avatarUrl: null,
          bio: null,
        }}
      />,
    );

    expect(screen.getByLabelText("Username")).toHaveValue("night_runner");
    expect(screen.getByLabelText("Display name")).toHaveValue("Night Runner");
    expect(
      screen.getByRole("img", { name: /night runner initials/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save profile/i })).toBeEnabled();
  });

  it("keeps edited profile values after a rejected save", async () => {
    const rejectedAction = vi.fn(async () => ({
      ok: false as const,
      error: {
        message: "Check the highlighted fields.",
        fieldErrors: { username: ["That username is already in use."] },
      },
    }));
    render(
      <ProfileForm
        action={rejectedAction}
        user={{
          username: "night_runner",
          displayName: "Night Runner",
          avatarUrl: null,
          bio: null,
        }}
      />,
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Night Runner Prime" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Save profile" }).closest("form")!,
    );

    await waitFor(() => expect(rejectedAction).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Display name")).toHaveValue(
      "Night Runner Prime",
    );
  });

  it("confirms before an in-app navigation discards profile edits", () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(
      <>
        <ProfileForm
          action={action}
          user={{
            username: "night_runner",
            displayName: "Night Runner",
            avatarUrl: null,
            bio: null,
          }}
        />
        <Link href="/games">Leave profile</Link>
      </>,
    );

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Edited name" },
    });
    const navigationAllowed = fireEvent.click(
      screen.getByRole("link", { name: "Leave profile" }),
    );

    expect(confirm).toHaveBeenCalledOnce();
    expect(navigationAllowed).toBe(false);
  });
});

describe("SettingsForm", () => {
  it("exposes preference controls with their saved defaults", () => {
    render(
      <SettingsForm
        action={action}
        values={{ locale: "en", reducedMotion: true, soundEnabled: false }}
      />,
    );

    expect(
      screen.getByRole("checkbox", { name: /reduce motion/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /sound effects/i }),
    ).not.toBeChecked();
    expect(
      screen.getByRole("button", { name: /save preferences/i }),
    ).toBeEnabled();
  });
});
