"use server";
import { actionMessageCode, semanticFieldErrors } from "@/i18n/action-messages";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { LOCALE_COOKIE, isLocale } from "@/i18n";
import { updateLocaleAction } from "./locale";

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
          message: "signInPreferences",
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
          message: actionMessageCode(result.error.message, result.error.code),
          ...(result.error.fieldErrors
            ? { fieldErrors: semanticFieldErrors(result.error.fieldErrors) }
            : {}),
        },
      };
    }

    revalidatePath("/settings");
    revalidatePath("/profile");
    if (isLocale(requestedLocale)) {
      (await cookies()).set(LOCALE_COOKIE, requestedLocale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
      revalidatePath("/", "layout");
    }
    return { ok: true, message: "preferencesSaved" };
  } catch {
    return {
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "preferencesFailure",
      },
    };
  }
}

export async function setGuestLocale(locale: string) {
  return updateLocaleAction(locale);
}
