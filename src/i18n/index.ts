import "server-only";
import { cookies } from "next/headers";
import { getCurrentSession } from "@/server/dal/session";
import { messages, type Locale, type TranslationKey } from "./messages";

export { messages };
export type { Locale, TranslationKey } from "./messages";
export const LOCALE_COOKIE = "twoplayer_locale";
export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fa";
}
export function resolveLocale(
  explicit?: unknown,
  preferred?: unknown,
  cookie?: unknown,
): Locale {
  if (isLocale(explicit)) return explicit;
  if (isLocale(preferred)) return preferred;
  if (isLocale(cookie)) return cookie;
  return "en";
}
export function translate(locale: Locale, key: TranslationKey): string {
  const [group, leaf] = key.split(".") as [keyof typeof messages.en, string];
  return (
    (messages[locale][group] as Record<string, string>)[leaf] ??
    messages.en[group][leaf as never] ??
    key
  );
}
export async function getRequestLocale(explicit?: unknown): Promise<Locale> {
  const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  const user = (await getCurrentSession())?.user;
  return resolveLocale(explicit, user?.locale, cookie);
}
