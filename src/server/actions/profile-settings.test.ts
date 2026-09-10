import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SafeUser } from "@/domain";

const mocks = vi.hoisted(() => ({
  getStrictCurrentUser: vi.fn(),
  revalidatePath: vi.fn(),
  updateProfile: vi.fn(),
  updateSettings: vi.fn(),
  setCookie: vi.fn(),
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ set: mocks.setCookie }),
}));
vi.mock("@/server/dal/session", () => ({
  getStrictCurrentUser: mocks.getStrictCurrentUser,
}));
vi.mock("@/server/auth", () => ({
  getAuthService: () => ({
    updateProfile: mocks.updateProfile,
    updateSettings: mocks.updateSettings,
  }),
}));

import { updateProfileAction } from "./profile";
import { updateSettingsAction } from "./settings";

const user: SafeUser = {
  id: "session-user",
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

describe("profile and settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStrictCurrentUser.mockResolvedValue(user);
  });

  it("rejects a profile mutation without an authenticated session", async () => {
    mocks.getStrictCurrentUser.mockResolvedValue(null);

    const result = await updateProfileAction({ ok: false }, new FormData());

    expect(result).toMatchObject({
      ok: false,
      error: { code: "UNAUTHENTICATED" },
    });
    expect(mocks.updateProfile).not.toHaveBeenCalled();
  });

  it("derives profile ownership from the session instead of form data", async () => {
    mocks.updateProfile.mockResolvedValue({ ok: true, data: { user } });
    const formData = new FormData();
    formData.set("userId", "attacker-controlled-id");
    formData.set("username", "night_runner");
    formData.set("displayName", "Night Runner Prime");
    formData.set("avatarUrl", "");
    formData.set("bio", "Co-op ready");

    const result = await updateProfileAction({ ok: false }, formData);

    expect(result).toEqual({ ok: true, message: "profileSaved" });
    expect(mocks.updateProfile).toHaveBeenCalledWith("session-user", {
      username: "night_runner",
      displayName: "Night Runner Prime",
      avatarUrl: "",
      bio: "Co-op ready",
    });
  });

  it("updates only allowed preferences for the session user", async () => {
    mocks.updateSettings.mockResolvedValue({ ok: true, data: { user } });
    const formData = new FormData();
    formData.set("userId", "attacker-controlled-id");
    formData.set("locale", "fa");
    formData.set("reducedMotion", "on");

    const result = await updateSettingsAction({ ok: false }, formData);

    expect(result).toEqual({ ok: true, message: "preferencesSaved" });
    expect(mocks.setCookie).toHaveBeenCalledWith(
      "twoplayer_locale",
      "fa",
      expect.any(Object),
    );
    expect(mocks.updateSettings).toHaveBeenCalledWith("session-user", {
      locale: "fa",
      reducedMotion: true,
      soundEnabled: false,
    });
  });

  it("reports an account-service outage instead of a false sign-out", async () => {
    mocks.getStrictCurrentUser.mockRejectedValue(new Error("database offline"));

    const result = await updateSettingsAction({ ok: false }, new FormData());

    expect(result).toMatchObject({
      ok: false,
      error: { code: "AUTH_UNAVAILABLE" },
    });
  });

  it("surfaces cookie persistence failures instead of claiming locale success", async () => {
    mocks.updateSettings.mockResolvedValue({ ok: true, data: { user } });
    mocks.setCookie.mockImplementationOnce(() => {
      throw new Error("cookie unavailable");
    });
    const form = new FormData();
    form.set("locale", "fa");
    expect(await updateSettingsAction({ ok: false }, form)).toMatchObject({
      ok: false,
      error: { message: "preferencesFailure" },
    });
  });
});
