import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getExpiredSessionCookieOptions,
  getSessionCookieOptions,
  hashSessionToken,
  issueSessionToken,
} from "./session";

afterEach(() => vi.unstubAllEnvs());

describe("session security", () => {
  it("stores a one-way digest and issues a finite opaque token", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    const issued = issueSessionToken(2, now, () => "opaque-test-token");

    expect(issued.tokenHash).toBe(hashSessionToken("opaque-test-token"));
    expect(issued.tokenHash).not.toContain(issued.token);
    expect(issued.expiresAt.toISOString()).toBe("2026-01-03T00:00:00.000Z");
  });

  it("uses HttpOnly, SameSite, path, and production Secure cookie defaults", () => {
    vi.stubEnv("NODE_ENV", "production");
    const now = new Date("2026-01-01T00:00:00.000Z");
    const expiresAt = new Date("2026-01-02T00:00:00.000Z");

    expect(getSessionCookieOptions(expiresAt, now)).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 86_400,
      expires: expiresAt,
    });
  });

  it("omits persistence attributes for a browser-session cookie", () => {
    vi.stubEnv("NODE_ENV", "development");
    const options = getSessionCookieOptions(
      new Date("2026-01-02T00:00:00.000Z"),
      new Date("2026-01-01T00:00:00.000Z"),
      { persistent: false },
    );

    expect(options).toEqual({
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
    });
    expect(getExpiredSessionCookieOptions()).toMatchObject({
      maxAge: 0,
      expires: new Date(0),
    });
  });
});
