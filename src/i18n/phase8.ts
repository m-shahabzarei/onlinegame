import { createTranslator } from "./core";
import type { Locale } from "./messages";
const cosmeticKeys = {
  "badge-first-light": "cosmeticNames.badge-first-light",
  "title-field-medic": "cosmeticNames.title-field-medic",
  "banner-quarantine": "cosmeticNames.banner-quarantine",
} as const;
export function localizedCosmeticName(locale: Locale, id: string) {
  const t = createTranslator(locale);
  const key = cosmeticKeys[id as keyof typeof cosmeticKeys];
  return t(key ?? "pages.cosmetics");
}
