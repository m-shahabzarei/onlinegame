import "server-only";

import { createHash, randomBytes } from "node:crypto";

import type { SessionKind } from "@/domain/auth";

export interface IssuedSessionToken {
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export interface SessionCookieOptions {
  readonly httpOnly: true;
  readonly sameSite: "lax";
  readonly secure: boolean;
  readonly path: "/";
  readonly maxAge?: number;
  readonly expires?: Date;
}

const TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1_000;

/** Create a high-entropy opaque value suitable for an HTTP-only cookie. */
export function generateSessionToken(): string {
  return randomBytes(TOKEN_BYTES).toString("base64url");
}

/** Store only this one-way digest in the database. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function issueSessionToken(
  ttlDays: number,
  now = new Date(),
  tokenFactory: () => string = generateSessionToken,
): IssuedSessionToken {
  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    throw new Error("Session TTL must be a positive number of days.");
  }

  const token = tokenFactory();
  return {
    token,
    tokenHash: hashSessionToken(token),
    expiresAt: new Date(now.getTime() + ttlDays * DAY_MS),
  };
}

export function getSessionCookieOptions(
  expiresAt: Date,
  now = new Date(),
  options: { readonly persistent?: boolean } = {},
): SessionCookieOptions {
  const base = {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  } as const;

  return options.persistent === false
    ? base
    : {
        ...base,
        maxAge: Math.max(
          0,
          Math.floor((expiresAt.getTime() - now.getTime()) / 1_000),
        ),
        expires: expiresAt,
      };
}

export function getExpiredSessionCookieOptions(): SessionCookieOptions {
  const expiresAt = new Date(0);
  return {
    ...getSessionCookieOptions(expiresAt),
    maxAge: 0,
  };
}

export function sessionKindToCookiePrefix(kind: SessionKind): string {
  return kind === "GUEST" ? "guest" : "user";
}
