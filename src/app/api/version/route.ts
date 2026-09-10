import { NextResponse } from "next/server";
import { PROTOCOL_VERSION } from "@/game/shared/config";

export const dynamic = "force-static";
export function GET() {
  return NextResponse.json(
    {
      service: "twoplayer-web",
      version: process.env.npm_package_version ?? "0.1.0",
      protocol: PROTOCOL_VERSION,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
