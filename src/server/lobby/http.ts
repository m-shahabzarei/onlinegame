import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { getStrictCurrentSession } from "@/server/dal/session";
import {
  inviteCodeSchema,
  LobbyError,
  lobbyCommandSchema,
  lobbyErrorResponse,
} from "@/domain/lobby";
import { getLobbyRuntime } from "./index";
import { browserChannel } from "./room-service";

export function verifyMutationOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const requestUrl = new URL(request.url);
  // Next's development Request URL uses the bound hostname; Host preserves
  // the browser's loopback origin. Browsers cannot override the Host header.
  const requestOrigin = `${requestUrl.protocol}//${request.headers.get("host") ?? requestUrl.host}`;
  let expected = requestOrigin;
  if (
    process.env.NEXT_PUBLIC_APP_URL &&
    (process.env.NODE_ENV === "production" ||
      process.env.TWOPLAYER_ENFORCE_ORIGIN === "1")
  ) {
    try {
      expected = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
    } catch {
      throw new LobbyError("FORBIDDEN");
    }
  }
  if (
    !origin ||
    origin !== expected ||
    request.headers.get("sec-fetch-site") === "cross-site"
  )
    throw new LobbyError("FORBIDDEN");
  if (request.headers.get("content-type")?.split(";")[0] !== "application/json")
    throw new LobbyError("INVALID_INPUT");
}
async function readJson(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new LobbyError("INVALID_INPUT");
  let size = 0;
  let text = "";
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new LobbyError("INVALID_INPUT");
    }
    text += decoder.decode(value, { stream: true });
  }
  try {
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch {
    throw new LobbyError("INVALID_INPUT");
  }
}
const heartbeatSchema = z
  .object({ code: inviteCodeSchema.nullable() })
  .strict();
const slugSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/);
export async function handleLobbyRequest(request: Request): Promise<Response> {
  const correlationId = randomUUID();
  const headers = {
    "Cache-Control": "private, no-store",
    "X-Request-Id": correlationId,
    "Referrer-Policy": "no-referrer",
  };
  try {
    const mutation = request.method === "POST";
    if (mutation) verifyMutationOrigin(request);
    const session = await getStrictCurrentSession();
    const { service, ephemeral, provider } = getLobbyRuntime();
    // Vercel supplies x-vercel-forwarded-for. Ignore client-selected forwarding headers.
    const network = process.env.VERCEL
      ? (request.headers.get("x-vercel-forwarded-for") ?? "unknown")
      : "local";
    const networkKey = createHash("sha256").update(network).digest("hex");
    await ephemeral.consume(`network:${networkKey}`, 300, 60_000);
    const url = new URL(request.url);
    const op = url.searchParams.get("op") ?? "list";
    if (op === "presence" && !mutation)
      return Response.json(
        { ok: true, data: await ephemeral.summary() },
        { headers },
      );
    if (!session || (session.kind === "GUEST") !== session.user.isGuest)
      throw new LobbyError("UNAUTHENTICATED");
    await ephemeral.consume(`session:${session.id}`, 180, 60_000);
    let data: unknown;
    if (mutation) {
      const body = await readJson(request);
      if (op === "heartbeat") {
        const parsed = heartbeatSchema.safeParse(body);
        if (!parsed.success) throw new LobbyError("INVALID_INPUT");
        await service.heartbeat(session.userId, parsed.data.code);
        data = { alive: true };
      } else if (op === "command") {
        const parsed = lobbyCommandSchema.safeParse(body);
        if (!parsed.success) throw new LobbyError("INVALID_INPUT");
        if (["create", "join"].includes(parsed.data.type)) {
          await ephemeral.consume(`attempt:${networkKey}`, 40, 60_000);
          await ephemeral.consume(
            `${parsed.data.type}:${session.userId}`,
            parsed.data.type === "create" ? 5 : 15,
            60_000,
          );
        }
        data = await service.execute(
          {
            id: session.userId,
            displayName: session.user.displayName,
            avatarUrl: session.user.avatarUrl,
            isGuest: session.user.isGuest,
          },
          parsed.data,
        );
      } else throw new LobbyError("INVALID_INPUT");
    } else if (op === "room" || op === "ticket") {
      const rawCode = url.searchParams.get("code");
      let code: string | null = null;
      if (rawCode !== null) {
        const parsed = inviteCodeSchema.safeParse(rawCode);
        if (!parsed.success) throw new LobbyError("INVALID_INPUT");
        code = parsed.data;
        await ephemeral.consume(`lookup:${session.userId}`, 90, 60_000);
      }
      if (op === "room") {
        if (!code) throw new LobbyError("INVALID_INPUT");
        data = await service.snapshot(session.userId, code);
      } else {
        const slug = slugSchema.safeParse(url.searchParams.get("slug"));
        if (!code && (!slug.success || slug.data !== "nightfall-protocol"))
          throw new LobbyError("INVALID_INPUT");
        const channel = code
          ? await service.subscriptionChannel(session.userId, code)
          : browserChannel(slug.data!);
        data = provider
          ? await provider.ticket(channel, +session.expiresAt)
          : { mode: "local", channel };
      }
    } else if (op === "list") {
      const parsed = slugSchema.safeParse(url.searchParams.get("slug"));
      if (!parsed.success) throw new LobbyError("INVALID_INPUT");
      data = {
        rooms: await service.list(parsed.data),
        currentCode: await service.currentRoom(session.userId),
      };
    } else throw new LobbyError("INVALID_INPUT");
    return Response.json({ ok: true, data }, { headers });
  } catch (error) {
    const mapped = lobbyErrorResponse(error);
    if (mapped.status >= 500)
      console.warn("TwoPlayer lobby request failed", {
        correlationId,
        code: mapped.error.code,
      });
    return Response.json(
      { ok: false, error: { ...mapped.error, correlationId } },
      {
        status: mapped.status,
        headers: {
          ...headers,
          ...(mapped.status === 429 ? { "Retry-After": "60" } : {}),
        },
      },
    );
  }
}
