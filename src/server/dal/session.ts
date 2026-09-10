import "server-only";

import { cookies } from "next/headers";
import { cache } from "react";

import type { AuthSession, SafeUser } from "@/domain";
import { getAuthService } from "../auth";
import {
  getExpiredSessionCookieOptions,
  getSessionCookieOptions,
} from "../auth/session";

export function getSessionCookieName(): string {
  // Cookie reads are part of the public shell and must remain safe when a
  // developer has not configured a database yet. Strict validation still
  // happens in `getServerEnv` before auth mutations are enabled.
  const configured = process.env.SESSION_COOKIE_NAME?.trim();
  return configured && /^[A-Za-z0-9_-]{1,64}$/.test(configured)
    ? configured
    : "twoplayer_session";
}

export async function readSessionToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(getSessionCookieName())?.value ?? null;
}

const resolveStrictCurrentSession = cache(
  async (): Promise<AuthSession | null> => {
    return getAuthService().getCurrentSessionStrict(await readSessionToken());
  },
);

export async function getCurrentSession(): Promise<AuthSession | null> {
  try {
    return await resolveStrictCurrentSession();
  } catch {
    // Public pages should render signed-out when auth configuration/database
    // is unavailable; protected mutations fail explicitly in their actions.
    return null;
  }
}

export async function getCurrentUser(): Promise<SafeUser | null> {
  return (await getCurrentSession())?.user ?? null;
}

/** Protected reads use the strict path so an outage is not shown as sign-out. */
export async function getStrictCurrentSession(): Promise<AuthSession | null> {
  return resolveStrictCurrentSession();
}

export async function getStrictCurrentUser(): Promise<SafeUser | null> {
  return (await getStrictCurrentSession())?.user ?? null;
}

export async function requireCurrentSession(): Promise<AuthSession> {
  const session = await getStrictCurrentSession();
  if (!session) {
    throw new Error("AUTHENTICATION_REQUIRED");
  }
  return session;
}

export async function requireCurrentUser(): Promise<SafeUser> {
  const session = await requireCurrentSession();
  return session.user;
}

/** Set the opaque token; this function never receives a password or hash. */
export async function setSessionCookie(
  token: string,
  expiresAt: Date,
  options: { readonly persistent?: boolean } = {},
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(
    getSessionCookieName(),
    token,
    getSessionCookieOptions(expiresAt, new Date(), options),
  );
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(getSessionCookieName(), "", getExpiredSessionCookieOptions());
}
