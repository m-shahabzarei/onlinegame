import "server-only";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { GameError } from "@/game/shared/protocol";
import { LobbyError } from "@/domain/lobby";
import { lifecycleClaimsSchema, verifyToken } from "@/game/shared/tokens";
import { getStrictCurrentSession } from "@/server/dal/session";
import { getLobbyRuntime } from "@/server/lobby";
import { verifyMutationOrigin } from "@/server/lobby/http";
import { gameplayWebConfig } from "./config";
import { getGameplayService } from "./index";
import { log } from "@/server/observability/logger";
const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
export async function boundedText(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new GameError("INVALID_MESSAGE");
  let size = 0,
    text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      throw new GameError("INVALID_MESSAGE");
    }
    text += decoder.decode(value, { stream: true });
  }
  return text + decoder.decode();
}
export async function gameplayRequest(request: Request, matchId: string) {
  const requestId = randomUUID();
  try {
    verifyMutationOrigin(request);
    const session = await getStrictCurrentSession();
    if (!session) throw new GameError("UNAUTHORIZED");
    if (!z.string().min(1).max(128).safeParse(matchId).success)
      throw new GameError("INVALID_MESSAGE");
    await getLobbyRuntime().ephemeral.consume(
      `gameplay:${session.id}`,
      30,
      60000,
    );
    let value: unknown;
    try {
      value = JSON.parse(await boundedText(request, 256));
    } catch {
      throw new GameError("INVALID_MESSAGE");
    }
    const body = z
      .object({ action: z.enum(["bootstrap", "leave"]) })
      .strict()
      .safeParse(value);
    if (!body.success) throw new GameError("INVALID_MESSAGE");
    const service = getGameplayService();
    const data =
      body.data.action === "bootstrap"
        ? await service.bootstrap(session, matchId)
        : await service.leave(session.userId, matchId);
    return Response.json(
      { ok: true, data: data ?? null },
      { headers: { ...headers, "X-Request-Id": requestId } },
    );
  } catch (error) {
    const code =
      error instanceof GameError
        ? error.code
        : error instanceof LobbyError
          ? error.code === "RATE_LIMITED"
            ? "RATE_LIMITED"
            : error.code === "FORBIDDEN"
              ? "UNAUTHORIZED"
              : error.code === "INVALID_INPUT"
                ? "INVALID_MESSAGE"
                : "SERVER_UNAVAILABLE"
          : "SERVER_UNAVAILABLE";
    log(error instanceof GameError ? "info" : "error", "gameplay_request", {
      requestId,
      matchId,
      code,
    });
    return Response.json(
      { ok: false, code },
      {
        status:
          code === "UNAUTHORIZED"
            ? 403
            : code === "MATCH_UNAVAILABLE"
              ? 410
              : code === "RATE_LIMITED"
                ? 429
                : code === "INVALID_MESSAGE"
                  ? 400
                  : 503,
        headers: {
          ...headers,
          "X-Request-Id": requestId,
          ...(code === "RATE_LIMITED" ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
export async function lifecycleRequest(request: Request) {
  try {
    const claims = verifyToken(
      await boundedText(request, 8192),
      gameplayWebConfig().controlSecret,
      lifecycleClaimsSchema,
    );
    await getGameplayService().lifecycle(claims);
    return Response.json({ ok: true }, { headers });
  } catch {
    return Response.json({ ok: false }, { status: 403, headers });
  }
}
export async function sweepRequest(request: Request) {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`),
    provided = Buffer.from(request.headers.get("authorization") ?? "");
  if (
    !process.env.CRON_SECRET ||
    expected.length !== provided.length ||
    !timingSafeEqual(expected, provided)
  )
    return new Response(null, { status: 403, headers });
  return Response.json(
    { expired: await getGameplayService().sweep() },
    { headers },
  );
}
