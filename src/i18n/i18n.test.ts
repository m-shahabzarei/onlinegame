import { describe, expect, it } from "vitest";
import { resolveLocale, translate } from "./index";
import { messages } from "./messages";
import {
  createTranslator,
  formatNumber,
  formatDate,
  localeDirection,
} from "./core";
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
  it("has exact recursive catalog and interpolation parity", () => {
    function compare(en: unknown, fa: unknown, key = "") {
      expect(typeof fa, key).toBe(typeof en);
      if (typeof en === "string") {
        expect(typeof fa === "string" && fa.trim().length > 0, key).toBe(true);
        const placeholders = (text: string) =>
          [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
        expect(placeholders(fa as string), key).toEqual(placeholders(en));
      } else {
        expect(Object.keys(fa as object).sort(), key).toEqual(
          Object.keys(en as object).sort(),
        );
        for (const [name, value] of Object.entries(en as object))
          compare(
            value,
            (fa as Record<string, unknown>)[name],
            `${key}.${name}`,
          );
      }
    }
    compare(messages.en, messages.fa);
  });
  it("formats dynamic values and plural forms with the selected locale", () => {
    const en = createTranslator("en"),
      fa = createTranslator("fa");
    expect(en("pages.catalogCount", { count: 1 })).toBe(
      "1 brief in the current catalog",
    );
    expect(en("pages.catalogCount", { count: 2 })).toBe(
      "2 briefs in the current catalog",
    );
    expect(fa("pages.catalogCount", { count: 2 })).toContain("۲");
    expect(fa("pages.playerCapacity", { count: 2 })).toContain("۲");
    expect(formatNumber("fa", 123)).toBe(
      new Intl.NumberFormat("fa").format(123),
    );
    expect(formatDate("fa", "2026-09-10T00:00:00Z")).toBe(
      new Intl.DateTimeFormat("fa", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date("2026-09-10T00:00:00Z")),
    );
    expect(localeDirection).toEqual({ en: "ltr", fa: "rtl" });
  });
  it("fails explicitly for a missing Persian key or interpolation parameter", () => {
    expect(() => translate("fa", "missing.key" as "navigation.games")).toThrow(
      "I18N_MISSING_KEY",
    );
    expect(() =>
      translate("fa", "pages.playerCapacity", {} as { count: number }),
    ).toThrow("I18N_MISSING_PARAMETER");
  });
});
