import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AuthSuccess, SafeUser } from "@/domain";

const mocks = vi.hoisted(() => ({
  clearSessionCookie: vi.fn(),
  createGuestSession: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  readSessionToken: vi.fn(),
  redirect: vi.fn(),
  register: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  RedirectType: { replace: "replace" },
}));
vi.mock("@/server/auth", () => ({
  getAuthService: () => ({
    createGuestSession: mocks.createGuestSession,
    login: mocks.login,
    logout: mocks.logout,
    register: mocks.register,
  }),
}));
vi.mock("@/server/dal/session", () => ({
  clearSessionCookie: mocks.clearSessionCookie,
  readSessionToken: mocks.readSessionToken,
  setSessionCookie: mocks.setSessionCookie,
}));

import { guestAction, loginAction, logoutAction } from "./auth";

const user: SafeUser = {
  id: "user-1",
  username: "night_runner",
  displayName: "Night Runner",
  avatarUrl: null,
  email: "night@example.test",
  isGuest: false,
  bio: null,
  locale: "en",
  reducedMotion: false,
  soundEnabled: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z"),
};

function authSuccess(overrides: Partial<AuthSuccess> = {}): AuthSuccess {
  const expiresAt = new Date("2026-02-01T00:00:00.000Z");
  return {
    user,
    token: "next-token",
    persistent: false,
    session: {
      id: "session-2",
      userId: user.id,
      kind: "USER",
      expiresAt,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      user,
    },
    ...overrides,
  };
}

describe("authentication actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.readSessionToken.mockResolvedValue("previous-token");
    mocks.logout.mockResolvedValue(undefined);
    mocks.setSessionCookie.mockResolvedValue(undefined);
    mocks.clearSessionCookie.mockResolvedValue(undefined);
  });

  it("passes the remember choice and revokes the replaced browser session", async () => {
    const success = authSuccess();
    mocks.login.mockResolvedValue({ ok: true, data: success });
    const formData = new FormData();
    formData.set("identifier", "night_runner");
    formData.set("password", "test-password");
    formData.set("next", "/profile");

    const result = await loginAction({ ok: false }, formData);

    expect(mocks.login).toHaveBeenCalledWith({
      identifier: "night_runner",
      password: "test-password",
      remember: false,
    });
    expect(mocks.logout).toHaveBeenCalledWith("previous-token");
    expect(mocks.setSessionCookie).toHaveBeenCalledWith(
      "next-token",
      success.session.expiresAt,
      { persistent: false },
    );
    expect(result).toMatchObject({
      ok: true,
      data: { redirectTo: "/profile" },
    });
  });

  it("replaces a guest session and rejects an unsafe redirect target", async () => {
    const guestUser = { ...user, id: "guest-2", isGuest: true, email: null };
    const success = authSuccess({
      user: guestUser,
      persistent: true,
      session: {
        id: "guest-session-2",
        userId: guestUser.id,
        kind: "GUEST",
        expiresAt: new Date("2026-01-02T00:00:00.000Z"),
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        user: guestUser,
      },
    });
    mocks.createGuestSession.mockResolvedValue({ ok: true, data: success });
    const formData = new FormData();
    formData.set("next", "/\\evil.example");

    const result = await guestAction({ ok: false }, formData);

    expect(mocks.logout).toHaveBeenCalledWith("previous-token");
    expect(result).toMatchObject({ ok: true, data: { redirectTo: "/" } });
  });

  it("preserves the previous session and revokes an unreachable replacement when cookie writing fails", async () => {
    mocks.login.mockResolvedValue({ ok: true, data: authSuccess() });
    mocks.setSessionCookie.mockRejectedValue(new Error("cookie unavailable"));
    const formData = new FormData();
    formData.set("identifier", "night_runner");
    formData.set("password", "test-password");

    const result = await loginAction({ ok: false }, formData);

    expect(mocks.logout).toHaveBeenCalledOnce();
    expect(mocks.logout).toHaveBeenCalledWith("next-token");
    expect(mocks.logout).not.toHaveBeenCalledWith("previous-token");
    expect(result).toMatchObject({
      ok: false,
      error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it("keeps the session retryable when server-side revocation fails", async () => {
    mocks.logout.mockRejectedValue(new Error("store unavailable"));

    const result = await logoutAction({ ok: false }, new FormData());

    expect(mocks.clearSessionCookie).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      ok: false,
      error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it("clears the cookie and redirects only after session revocation succeeds", async () => {
    await logoutAction({ ok: false }, new FormData());

    expect(mocks.logout).toHaveBeenCalledWith("previous-token");
    expect(mocks.clearSessionCookie).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/", "replace");
  });
});
