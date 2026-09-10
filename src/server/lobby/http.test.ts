// @vitest-environment node
import { randomUUID } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyError } from "@/domain/lobby";
const mock = vi.hoisted(() => ({
  session: vi.fn(),
  execute: vi.fn(),
  consume: vi.fn(),
  heartbeat: vi.fn(),
  snapshot: vi.fn(),
  ticket: vi.fn(),
  subscriptionChannel: vi.fn(),
  summary: vi.fn(),
}));
vi.mock("@/server/dal/session", () => ({
  getStrictCurrentSession: mock.session,
}));
vi.mock("./index", () => ({
  getLobbyRuntime: () => ({
    service: {
      execute: mock.execute,
      heartbeat: mock.heartbeat,
      snapshot: mock.snapshot,
      subscriptionChannel: mock.subscriptionChannel,
    },
    ephemeral: { consume: mock.consume, summary: mock.summary },
    provider: { ticket: mock.ticket },
  }),
}));
import { handleLobbyRequest } from "./http";
const base = "http://localhost:3000/api/lobby";
beforeEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
  mock.session.mockResolvedValue({
    id: "session-a",
    userId: "a",
    kind: "GUEST",
    expiresAt: new Date(Date.now() + 60000),
    user: {
      displayName: "Guest",
      avatarUrl: null,
      isGuest: true,
      email: "never-expose@example.test",
    },
  });
  mock.consume.mockResolvedValue(undefined);
  mock.execute.mockResolvedValue({ room: null, code: "ABCD2345" });
  mock.subscriptionChannel.mockResolvedValue("tp:room:opaque");
  mock.ticket.mockResolvedValue({
    mode: "ably",
    channel: "tp:room:opaque",
    token: "short-lived-test-token",
  });
});
function post(body: unknown, origin = "http://localhost:3000") {
  return new Request(`${base}?op=command`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}
const create = () => ({
  type: "create",
  requestId: randomUUID(),
  slug: "nightfall-protocol",
  visibility: "PUBLIC",
});
describe("lobby HTTP security boundary", () => {
  it("accepts a matching loopback Host in development and requires the canonical production origin", async () => {
    const request = post(create(), "http://127.0.0.1:3000");
    request.headers.set("host", "127.0.0.1:3000");
    expect((await handleLobbyRequest(request)).status).toBe(200);
    vi.stubEnv("NODE_ENV", "production");
    const foreign = post(create(), "http://127.0.0.1:3000");
    foreign.headers.set("host", "127.0.0.1:3000");
    expect((await handleLobbyRequest(foreign)).status).toBe(403);
  });
  it("derives actor identity only from the verified session", async () => {
    const result = await handleLobbyRequest(post(create()));
    expect(result.status).toBe(200);
    expect(mock.execute).toHaveBeenCalledWith(
      { id: "a", displayName: "Guest", avatarUrl: null, isGuest: true },
      expect.anything(),
    );
    expect(result.headers.get("cache-control")).toContain("no-store");
    expect(result.headers.get("x-request-id")).toBeTruthy();
  });
  it.each(["https://attacker.example", "null", ""])(
    "rejects foreign/missing mutation origin %s",
    async (origin) => {
      expect((await handleLobbyRequest(post(create(), origin))).status).toBe(
        403,
      );
      expect(mock.execute).not.toHaveBeenCalled();
    },
  );
  it("rejects malformed identity or expired sessions", async () => {
    mock.session.mockResolvedValueOnce(null);
    expect((await handleLobbyRequest(post(create()))).status).toBe(401);
    mock.session.mockResolvedValueOnce({
      kind: "GUEST",
      user: { isGuest: false },
    });
    expect((await handleLobbyRequest(post(create()))).status).toBe(401);
  });
  it("rejects client roles, oversized bodies, and non-JSON requests", async () => {
    expect(
      (await handleLobbyRequest(post({ ...create(), hostUserId: "other" })))
        .status,
    ).toBe(400);
    expect(
      (await handleLobbyRequest(post({ code: "x".repeat(5000) }))).status,
    ).toBe(400);
    const request = new Request(`${base}?op=command`, {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "text/plain",
      },
      body: "{}",
    });
    expect((await handleLobbyRequest(request)).status).toBe(400);
  });
  it("cannot subscribe to a room before membership authorization", async () => {
    mock.subscriptionChannel.mockRejectedValueOnce(
      new LobbyError("ROOM_UNAVAILABLE"),
    );
    const response = await handleLobbyRequest(
      new Request(`${base}?op=ticket&code=ABCD2345`),
    );
    expect(response.status).toBe(404);
    expect(mock.ticket).not.toHaveBeenCalled();
  });
  it("rate limits requests and returns a retry window", async () => {
    mock.consume.mockRejectedValueOnce(new LobbyError("RATE_LIMITED"));
    const result = await handleLobbyRequest(post(create()));
    expect(result.status).toBe(429);
    expect(result.headers.get("retry-after")).toBe("60");
    expect(mock.execute).not.toHaveBeenCalled();
  });
  it("discards caller-reported presence status", async () => {
    const request = new Request(`${base}?op=heartbeat`, {
      method: "POST",
      headers: {
        Origin: "http://localhost:3000",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ code: null, state: "IN_GAME" }),
    });
    expect((await handleLobbyRequest(request)).status).toBe(400);
    expect(mock.heartbeat).not.toHaveBeenCalled();
  });
  it("sanitizes infrastructure failures and returns a correlation ID", async () => {
    const log = vi.spyOn(console, "warn").mockImplementation(() => {});
    mock.execute.mockRejectedValueOnce(
      new Error("postgresql://secret-password"),
    );
    const response = await handleLobbyRequest(post(create()));
    expect(response.status).toBe(503);
    const text = await response.text();
    expect(text).not.toContain("secret-password");
    expect(text).toContain("correlationId");
    log.mockRestore();
  });
});
