import { NextResponse } from "next/server";

export const dynamic = "force-static";
export function GET() {
  return NextResponse.json(
    {
      service: "twoplayer-web",
      version: process.env.npm_package_version ?? "0.1.0",
      protocol: 2,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      },
    },
  );
}
