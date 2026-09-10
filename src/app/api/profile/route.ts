import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getStrictCurrentSession } from "@/server/dal/session";
import { verifyMutationOrigin } from "@/server/lobby/http";
import { phase8Service } from "@/server/phase8/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = {
  "Cache-Control": "private, no-store",
  "Referrer-Policy": "no-referrer",
};
const bodySchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("equipCosmetic"),
      cosmeticId: z.string().regex(/^[a-z0-9-]+$/),
    })
    .strict(),
  z
    .object({
      action: z.literal("report"),
      targetUserId: z.string().min(1).max(128),
      matchId: z.string().min(1).max(128).optional(),
      reason: z.enum(["ABUSE", "CHEATING", "HARASSMENT", "EXPLOIT", "OTHER"]),
      details: z.string().max(500).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("block"),
      targetUserId: z.string().min(1).max(128),
      blocked: z.boolean(),
    })
    .strict(),
  z
    .object({
      action: z.literal("onboarding"),
      version: z.number().int().min(0).max(100),
      completed: z.boolean(),
    })
    .strict(),
  z
    .object({ action: z.literal("analyticsPreference"), optOut: z.boolean() })
    .strict(),
]);

async function sessionOrUnauthorized() {
  const session = await getStrictCurrentSession();
  if (!session) throw new Error("UNAUTHORIZED");
  return session;
}

export async function GET(request: Request) {
  const requestId = randomUUID();
  try {
    const session = await sessionOrUnauthorized();
    const url = new URL(request.url);
    const view = url.searchParams.get("view") ?? "summary";
    const data =
      view === "history"
        ? await phase8Service.history(session.userId, {
            ...(url.searchParams.get("cursor")
              ? { cursor: url.searchParams.get("cursor")! }
              : {}),
            ...(url.searchParams.get("limit")
              ? { limit: Number(url.searchParams.get("limit")) }
              : {}),
          })
        : view === "challenges"
          ? await phase8Service.challenges(session.userId)
          : view === "cosmetics"
            ? await phase8Service.cosmetics(session.userId)
            : await phase8Service.profileSummary(session.userId);
    return Response.json(
      { ok: true, data },
      { headers: { ...headers, "X-Request-Id": requestId } },
    );
  } catch (error) {
    const status =
      error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 503;
    return Response.json(
      {
        ok: false,
        code: status === 401 ? "UNAUTHORIZED" : "SERVICE_UNAVAILABLE",
        requestId,
      },
      { status, headers },
    );
  }
}

export async function POST(request: Request) {
  const requestId = randomUUID();
  try {
    verifyMutationOrigin(request);
    const session = await sessionOrUnauthorized();
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { ok: false, code: "INVALID_INPUT", requestId },
        { status: 400, headers },
      );
    const body = parsed.data;
    let data: unknown = null;
    if (body.action === "equipCosmetic")
      data = await phase8Service.equipCosmetic(session.userId, body.cosmeticId);
    else if (body.action === "report")
      data = await phase8Service.report(session.userId, body);
    else if (body.action === "block")
      data = await phase8Service.setBlock(
        session.userId,
        body.targetUserId,
        body.blocked,
      );
    else if (body.action === "onboarding")
      data = await import("@/server/phase8/preferences").then((module) =>
        module.saveOnboarding(session.userId, body.version, body.completed),
      );
    else
      data = await import("@/server/phase8/preferences").then((module) =>
        module.saveAnalyticsPreference(session.userId, body.optOut),
      );
    return Response.json(
      { ok: true, data },
      { headers: { ...headers, "X-Request-Id": requestId } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code =
      message === "UNAUTHORIZED"
        ? "UNAUTHORIZED"
        : message === "REPORT_RATE_LIMITED"
          ? "RATE_LIMITED"
          : "INVALID_REQUEST";
    return Response.json(
      { ok: false, code, requestId },
      {
        status:
          code === "UNAUTHORIZED" ? 401 : code === "RATE_LIMITED" ? 429 : 400,
        headers: {
          ...headers,
          ...(code === "RATE_LIMITED" ? { "Retry-After": "86400" } : {}),
        },
      },
    );
  }
}
