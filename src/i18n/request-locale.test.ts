import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ cookie: vi.fn(), session: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: mocks.cookie }),
}));
vi.mock("@/server/dal/session", () => ({ getCurrentSession: mocks.session }));
import { getRequestLocale } from "./index";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.cookie.mockReturnValue({ value: "fa" });
  mocks.session.mockResolvedValue(null);
});
it("uses an authenticated preference ahead of a stale cookie and lets explicit locale override it", async () => {
  mocks.session.mockResolvedValue({ user: { locale: "en", isGuest: false } });
  expect(await getRequestLocale()).toBe("en");
  expect(await getRequestLocale("fa")).toBe("fa");
});
it("uses the persisted guest cookie even when the temporary user record still contains English", async () => {
  mocks.session.mockResolvedValue({ user: { locale: "en", isGuest: true } });
  expect(await getRequestLocale()).toBe("fa");
});
it("uses cookies when signed out and English only when no supported preference exists", async () => {
  expect(await getRequestLocale()).toBe("fa");
  mocks.cookie.mockReturnValue({ value: "invalid" });
  expect(await getRequestLocale()).toBe("en");
});
