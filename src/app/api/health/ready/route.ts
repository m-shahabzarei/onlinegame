import { NextResponse } from "next/server";
import { getReadinessStatus } from "@/server/services/readiness-service";

export const dynamic = "force-dynamic";
export async function GET() {
  const result = await getReadinessStatus();
  return NextResponse.json(result.body, {
    status: result.httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
