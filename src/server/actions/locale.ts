"use server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { isLocale, LOCALE_COOKIE } from "@/i18n/core";
import { getAuthService } from "@/server/auth";
import { readSessionToken } from "@/server/dal/session";

export async function updateLocaleAction(
  locale: unknown,
): Promise<
  { ok: true } | { ok: false; code: "invalid_locale" | "locale_save_failed" }
> {
  if (!isLocale(locale)) return { ok: false, code: "invalid_locale" };
  try {
    // Avoid caching the old User.locale in the action's render context.
    const token = await readSessionToken();
    const user = token
      ? (await getAuthService().getCurrentSessionStrict(token))?.user
      : null;
    const cookieStore = await cookies();
    if (user && !user.isGuest) {
      const result = await getAuthService().updateSettings(user.id, { locale });
      if (!result.ok) return { ok: false, code: "locale_save_failed" };
    }
    cookieStore.set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });
    revalidatePath("/", "layout");
    return { ok: true };
  } catch {
    return { ok: false, code: "locale_save_failed" };
  }
}
