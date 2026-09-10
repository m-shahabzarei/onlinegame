"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n";

import { getAuthService } from "@/server/auth";
import { getStrictCurrentUser } from "@/server/dal/session";

import type { ActionState } from "./auth";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export async function updateSettingsAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const user = await getStrictCurrentUser();
    if (!user) {
      return {
        ok: false,
        error: {
          code: "UNAUTHENTICATED",
          message: "Sign in to update your preferences.",
        },
      };
    }

    const requestedLocale = formString(formData, "locale");
    const result = await getAuthService().updateSettings(user.id, {
      locale: isLocale(requestedLocale) ? requestedLocale : null,
      reducedMotion: formData.has("reducedMotion"),
      soundEnabled: formData.has("soundEnabled"),
    });

    if (!result.ok) {
      return {
        ok: false,
        error: {
          ...(result.error.code ? { code: result.error.code } : {}),
          message: result.error.message,
          ...(result.error.fieldErrors
            ? { fieldErrors: result.error.fieldErrors }
            : {}),
        },
      };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");
    if (isLocale(requestedLocale)) {
      try {
        (await cookies()).set(LOCALE_COOKIE, requestedLocale, {
          path: "/",
          maxAge: 60 * 60 * 24 * 365,
          sameSite: "lax",
        });
      } catch {
        // Cookie writes are unavailable in isolated action tests and some edge runtimes;
        // the authenticated preference remains durable in User.locale.
      }
    }
    return { ok: true, message: "Preferences saved." };
  } catch {
    return {
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "We could not save your preferences. Try again shortly.",
      },
    };
  }
}

export async function setGuestLocale(locale: string) {
  if (!isLocale(locale)) return;
  try {
    (await cookies()).set(LOCALE_COOKIE, locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
    });
  } catch {
    return;
  }
  revalidatePath("/", "layout");
}
