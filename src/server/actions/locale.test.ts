import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  token: vi.fn(),
  session: vi.fn(),
  update: vi.fn(),
  set: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("next/headers", () => ({ cookies: async () => ({ set: mocks.set }) }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
vi.mock("@/server/dal/session", () => ({ readSessionToken: mocks.token }));
vi.mock("@/server/auth", () => ({
  getAuthService: () => ({
    getCurrentSessionStrict: mocks.session,
    updateSettings: mocks.update,
  }),
}));
import { updateLocaleAction } from "./locale";
describe("durable locale switching", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.token.mockResolvedValue(null);
    mocks.update.mockResolvedValue({ ok: true });
  });
  it("persists a signed-out locale without requiring the account service", async () => {
    expect(await updateLocaleAction("fa")).toEqual({ ok: true });
    expect(mocks.session).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith(
      "twoplayer_locale",
      "fa",
      expect.objectContaining({ path: "/", sameSite: "lax" }),
    );
    expect(mocks.revalidate).toHaveBeenCalledWith("/", "layout");
  });
  it("updates authenticated User.locale before writing its matching cookie", async () => {
    mocks.token.mockResolvedValue("session-token");
    mocks.session.mockResolvedValue({
      user: { id: "actual-user", isGuest: false, locale: "en" },
    });
    expect(await updateLocaleAction("fa")).toEqual({ ok: true });
    expect(mocks.update).toHaveBeenCalledWith("actual-user", { locale: "fa" });
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.set.mock.invocationCallOrder[0]!,
    );
  });
  it("stores guest choice only in the locale cookie", async () => {
    mocks.token.mockResolvedValue("guest-token");
    mocks.session.mockResolvedValue({
      user: { id: "guest", isGuest: true, locale: "en" },
    });
    expect(await updateLocaleAction("fa")).toEqual({ ok: true });
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalled();
  });
  it("reports persistence errors and does not publish a conflicting cookie", async () => {
    mocks.token.mockResolvedValue("session-token");
    mocks.session.mockResolvedValue({ user: { id: "user", isGuest: false } });
    mocks.update.mockResolvedValue({ ok: false });
    expect(await updateLocaleAction("fa")).toEqual({
      ok: false,
      code: "locale_save_failed",
    });
    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.revalidate).not.toHaveBeenCalled();
  });
  it("rejects unsupported values and surfaces cookie failure", async () => {
    expect(await updateLocaleAction("de")).toEqual({
      ok: false,
      code: "invalid_locale",
    });
    expect(mocks.token).not.toHaveBeenCalled();
    mocks.set.mockImplementation(() => {
      throw new Error("cookie failure");
    });
    expect(await updateLocaleAction("fa")).toEqual({
      ok: false,
      code: "locale_save_failed",
    });
  });
});
