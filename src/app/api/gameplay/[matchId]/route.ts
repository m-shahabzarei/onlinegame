import { gameplayRequest } from "@/server/gameplay/http";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ matchId: string }> },
) {
  return gameplayRequest(request, (await params).matchId);
}
