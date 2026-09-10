"use server";

import { revalidatePath } from "next/cache";

import type { AuthResult, SafeUser } from "@/domain";
import { getAuthService } from "@/server/auth";
import { getStrictCurrentUser } from "@/server/dal/session";

import type { ActionState } from "./auth";

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function mapResult(
  result: AuthResult<{ readonly user: SafeUser }>,
): ActionState {
  if (result.ok) return { ok: true, message: "Profile saved." };
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

export async function updateProfileAction(
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
          message: "Sign in to update your profile.",
        },
      };
    }

    const result = await getAuthService().updateProfile(user.id, {
      username: formString(formData, "username"),
      displayName: formString(formData, "displayName"),
      avatarUrl: formString(formData, "avatarUrl"),
      bio: formString(formData, "bio"),
    });
    const state = mapResult(result);
    if (state.ok) {
      revalidatePath("/profile");
      revalidatePath("/settings");
    }
    return state;
  } catch {
    return {
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "We could not save your profile. Try again shortly.",
      },
    };
  }
}
