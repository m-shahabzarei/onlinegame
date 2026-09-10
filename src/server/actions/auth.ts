"use server";
import { actionMessageCode, semanticFieldErrors } from "@/i18n/action-messages";

import { redirect, RedirectType } from "next/navigation";

import type { AuthResult, AuthSuccess } from "@/domain";
import { getSafeInternalPath } from "@/lib/safe-internal-path";
import { getAuthService, type AuthService } from "@/server/auth";
import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
} from "@/server/dal/session";

export interface ActionFieldErrors {
  readonly [field: string]: readonly string[] | undefined;
}

export interface ActionState {
  readonly ok: boolean;
  readonly message?: string;
  readonly error?: {
    readonly code?: string;
    readonly message: string;
    readonly fieldErrors?: ActionFieldErrors;
  };
  readonly data?: {
    readonly redirectTo?: string;
    readonly [key: string]: unknown;
  };
}

const unavailableState: ActionState = {
  ok: false,
  error: {
    code: "AUTH_UNAVAILABLE",
    message: "actionUnavailable",
  },
};

function formString(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function mapResult(result: AuthResult<AuthSuccess>): ActionState {
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

  return { ok: true };
}

async function replaceCurrentSession(
  service: AuthService,
  previousToken: string | null,
  next: AuthSuccess,
): Promise<void> {
  try {
    await setSessionCookie(next.token, next.session.expiresAt, {
      persistent: next.persistent,
    });
  } catch (error) {
    try {
      await service.logout(next.token);
    } catch {
      console.error(
        "Unreachable replacement session could not be revoked after cookie failure.",
      );
    }
    throw error;
  }

  if (previousToken && previousToken !== next.token) {
    try {
      await service.logout(previousToken);
    } catch {
      // A new high-entropy session is still safe to issue. Retaining the prior
      // digest is observable cleanup debt, not a reason to strand the user.
      console.error(
        "Previous browser session could not be revoked during replacement.",
      );
    }
  }
}

/** Register a permanent account and issue an HTTP-only session cookie. */
export async function registerAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const service = getAuthService();
    const previousToken = await readSessionToken();
    const result = await service.register({
      email: formString(formData, "email"),
      username: formString(formData, "username"),
      displayName: formString(formData, "displayName"),
      password: formString(formData, "password"),
      passwordConfirmation: formString(formData, "passwordConfirmation"),
    });

    if (!result.ok) return mapResult(result);

    await replaceCurrentSession(service, previousToken, result.data);
    return {
      ok: true,
      message: "accountReady",
      data: {
        redirectTo: getSafeInternalPath(formData.get("next"), "/profile"),
      },
    };
  } catch {
    return unavailableState;
  }
}

/** Authenticate an existing account by email or username. */
export async function loginAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const service = getAuthService();
    const previousToken = await readSessionToken();
    const result = await service.login({
      identifier: formString(formData, "identifier"),
      password: formString(formData, "password"),
      remember: formData.has("remember"),
    });

    if (!result.ok) return mapResult(result);

    await replaceCurrentSession(service, previousToken, result.data);
    return {
      ok: true,
      message: "signedIn",
      data: { redirectTo: getSafeInternalPath(formData.get("next"), "/") },
    };
  } catch {
    return unavailableState;
  }
}

/** Create a clearly temporary guest identity. */
export async function guestAction(
  _previousState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const service = getAuthService();
    const previousToken = await readSessionToken();
    const result = await service.createGuestSession();
    if (!result.ok) return mapResult(result);

    await replaceCurrentSession(service, previousToken, result.data);
    return {
      ok: true,
      message: "guestStarted",
      data: { redirectTo: getSafeInternalPath(formData.get("next"), "/") },
    };
  } catch {
    return unavailableState;
  }
}

/** Revoke the current session before returning to the public discover page. */
export async function logoutAction(
  _previousState: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  void _previousState;
  void _formData;

  try {
    await getAuthService().logout(await readSessionToken());
    await clearSessionCookie();
  } catch {
    return {
      ok: false,
      error: {
        code: "AUTH_UNAVAILABLE",
        message: "logoutFailure",
      },
    };
  }

  redirect("/", RedirectType.replace);
}
