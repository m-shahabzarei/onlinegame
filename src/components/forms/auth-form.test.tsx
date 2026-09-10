import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AuthForm, GuestForm } from "./auth-form";
import { LogoutButton } from "./logout-button";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

const action = async () => ({ ok: false as const });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("AuthForm", () => {
  it("renders registration fields with explicit labels and confirmation", () => {
    render(<AuthForm action={action} mode="register" />);

    expect(
      screen.getByRole("heading", { name: /create your twoplayer account/i }),
    ).toBeVisible();
    expect(screen.getByLabelText("Username")).toBeRequired();
    expect(screen.getByLabelText("Email")).toBeRequired();
    expect(screen.getByLabelText("Display name")).toBeRequired();
    expect(screen.getByLabelText("Confirm password")).toBeRequired();
  });

  it("preserves valid registration input after a server validation error", async () => {
    const rejectedAction = vi.fn(async () => ({
      ok: false as const,
      error: {
        message: "Check the highlighted fields.",
        fieldErrors: { username: ["That username is already in use."] },
      },
    }));
    render(<AuthForm action={rejectedAction} mode="register" />);

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "night_runner" },
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "night@example.test" },
    });
    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "Night Runner" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "test-password" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "test-password" },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Create account" }).closest("form")!,
    );

    await waitFor(() => expect(rejectedAction).toHaveBeenCalledOnce());
    expect(screen.getByLabelText("Email")).toHaveValue("night@example.test");
    expect(screen.getByLabelText("Display name")).toHaveValue("Night Runner");
  });

  it("offers a persistent-session choice on login", () => {
    render(<AuthForm action={action} mode="login" />);

    expect(screen.getByLabelText("Email or username")).toBeRequired();
    expect(
      screen.getByRole("checkbox", { name: /keep me signed in/i }),
    ).toBeChecked();
    expect(
      screen.getByRole("link", { name: /continue as a guest/i }),
    ).toHaveAttribute("href", "/continue-as-guest");
  });
});

describe("GuestForm", () => {
  it("explains temporary limitations before starting a session", () => {
    render(<GuestForm action={action} />);

    expect(
      screen.getByRole("heading", { name: /explore as a guest/i }),
    ).toBeVisible();
    expect(
      screen.getByRole("list", { name: /guest mode limitations/i }),
    ).toHaveTextContent(/multiplayer rooms/i);
    expect(
      screen.getByRole("button", { name: /continue as guest/i }),
    ).toBeEnabled();
  });
});

describe("LogoutButton", () => {
  it("keeps a failed revocation visible and retryable", async () => {
    const failedLogout = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "The session could not be revoked. Try again.",
      },
    }));
    render(<LogoutButton action={failedLogout} />);

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be revoked/i,
    );
    expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
  });
});
