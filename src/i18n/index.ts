import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { getCurrentSession } from "@/server/dal/session";
import { LOCALE_COOKIE, resolveLocale } from "./core";
import type { Locale } from "./messages";
export { messages } from "./messages";
export type { Locale, TranslationKey } from "./messages";
export * from "./core";
export const getRequestLocale = cache(
  async (explicit?: unknown): Promise<Locale> => {
    const cookie = (await cookies()).get(LOCALE_COOKIE)?.value;
    const user = (await getCurrentSession())?.user;
    return resolveLocale(
      explicit,
      user?.isGuest ? undefined : user?.locale,
      cookie,
    );
  },
);
