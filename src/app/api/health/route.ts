import { NextResponse } from "next/server";

import { getHealthStatus } from "@/server/services/health-service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export function GET() {
  const result = getHealthStatus();

  return NextResponse.json(result.body, {
    status: result.httpStatus,
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
