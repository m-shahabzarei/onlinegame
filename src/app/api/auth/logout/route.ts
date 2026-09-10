import { NextResponse } from "next/server";

import { getAuthService } from "@/server/auth";
import { clearSessionCookie, readSessionToken } from "@/server/dal/session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** End the current session without exposing token or database details. */
export async function POST(): Promise<NextResponse> {
  try {
    await getAuthService().logout(await readSessionToken());
    await clearSessionCookie();
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Keep the browser token when revocation fails so the user can retry and
    // the UI cannot claim a local sign-out while the server session is active.
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "AUTH_UNAVAILABLE",
          message: "We could not complete sign out. Try again.",
        },
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
