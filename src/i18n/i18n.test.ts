import { describe, expect, it } from "vitest";
import { resolveLocale, translate } from "./index";
describe("locale resolution", () => {
  it("uses explicit, user, cookie, then English fallback", () => {
    expect(resolveLocale("fa", "en", "en")).toBe("fa");
    expect(resolveLocale(undefined, "fa", "en")).toBe("fa");
    expect(resolveLocale(undefined, undefined, "fa")).toBe("fa");
    expect(resolveLocale(undefined, "de", "ar")).toBe("en");
  });
  it("has stable typed translations for both locales", () => {
    expect(translate("en", "navigation.games")).toBe("Games");
    expect(translate("fa", "navigation.games")).toBe("بازی‌ها");
  });
});
