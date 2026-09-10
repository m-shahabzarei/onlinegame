// @vitest-environment node
import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { SIMULATION } from "../../src/game/shared/config";
import {
  neutralInput,
  serverMessageSchema,
  type Reservation,
  type ServerMessage,
} from "../../src/game/shared/protocol";
import { signToken, tokenTimes } from "../../src/game/shared/tokens";
import { createGameplayService } from "./server";
const joinSecret = "integration-join-secret-at-least-32",
  controlSecret = "integration-control-secret-at-least-32",
  origin = "http://localhost:3100";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(get: () => T | undefined, ms = 5000): Promise<T> {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    const value = get();
    if (value !== undefined) return value;
    await sleep(15);
  }
  throw new Error("Timed out waiting for authoritative state");
}
interface Client {
  ws: WebSocket;
  messages: ServerMessage[];
  send(message: unknown): void;
}
describe("real WebSocket service integration", () => {
  let service: Awaited<ReturnType<typeof createGameplayService>> | undefined;
  const clients: Client[] = [];
  afterEach(async () => {
    for (const client of clients) client.ws.terminate();
    clients.length = 0;
    await service?.close();
    service = undefined;
  });
  async function setup() {
    const lifecycle: string[] = [];
    service = await createGameplayService({
      joinSecret,
      controlSecret,
      origins: [origin],
      simulation: {
        ...SIMULATION,
        countdownMs: 100,
        startupMs: 10000,
        reconnectMs: 2500,
      },
      lifecycle: async (_id, _runtime, state) => {
        lifecycle.push(state);
      },
    });
    await new Promise<void>((resolve) =>
      service!.http.listen(0, "127.0.0.1", resolve),
    );
    const address = service.http.address();
    if (!address || typeof address === "string") throw new Error("No port");
    const url = `http://127.0.0.1:${address.port}`,
      wsUrl = `ws://127.0.0.1:${address.port}/gameplay`;
    const { serverEpoch } = await (await fetch(`${url}/health`)).json();
    const reservation: Reservation = {
      matchId: randomUUID(),
      roomId: randomUUID(),
      runtimeId: randomUUID(),
      serverEpoch,
      createdAt: Date.now(),
      players: [
        { userId: "a", playerId: "pa", name: "Alpha", kind: "USER", slot: 0 },
        { userId: "b", playerId: "pb", name: "Bravo", kind: "GUEST", slot: 1 },
      ],
    };
    const control = signToken(
      {
        ...tokenTimes(),
        aud: "twoplayer-control",
        action: "reserve",
        reservation,
      },
      controlSecret,
    );
    expect(
      (await fetch(`${url}/control`, { method: "POST", body: control })).ok,
    ).toBe(true);
    const ticket = (slot: 0 | 1, changes: Record<string, unknown> = {}) =>
      signToken(
        {
          ...tokenTimes(),
          aud: "twoplayer-gameplay",
          matchId: reservation.matchId,
          roomId: reservation.roomId,
          runtimeId: reservation.runtimeId,
          ...reservation.players[slot],
          ...changes,
        },
        joinSecret,
      );
    async function client(token: string) {
      const ws = new WebSocket(wsUrl, { origin });
      const messages: ServerMessage[] = [];
      const c: Client = {
        ws,
        messages,
        send: (m) => ws.send(JSON.stringify(m)),
      };
      clients.push(c);
      ws.on("message", (raw) =>
        messages.push(serverMessageSchema.parse(JSON.parse(raw.toString()))),
      );
      ws.on("error", () => {});
      await new Promise<void>((resolve) => ws.once("open", resolve));
      c.send({ v: 2, type: "join", token });
      return c;
    }
    return { reservation, ticket, client, lifecycle, url, wsUrl };
  }
  it("rejects invalid identity, expiry, token reuse and disallowed origins", async () => {
    const f = await setup();
    const invalid = await f.client(f.ticket(0, { userId: "outsider" }));
    expect(
      (
        await until(() =>
          invalid.messages.find((m) => m.type === "serverError"),
        )
      ).type,
    ).toBe("serverError");
    const expired = await f.client(
      f.ticket(0, { iat: Date.now() - 5000, exp: Date.now() - 1000 }),
    );
    expect(
      await until(() => expired.messages.find((m) => m.type === "serverError")),
    ).toMatchObject({ code: "TOKEN_EXPIRED" });
    const token = f.ticket(0);
    const first = await f.client(token);
    await until(() => first.messages.find((m) => m.type === "welcome"));
    const reused = await f.client(token);
    expect(
      await until(() => reused.messages.find((m) => m.type === "serverError")),
    ).toMatchObject({ code: "TOKEN_USED" });
    const badOrigin = new WebSocket(f.wsUrl, {
      origin: "https://attacker.invalid",
    });
    const status = await new Promise<number>((resolve) => {
      badOrigin.on("unexpected-response", (_req, res) => {
        resolve(res.statusCode!);
        res.resume();
        badOrigin.terminate();
      });
      badOrigin.on("error", () => {});
    });
    expect(status).toBe(403);
  }, 15000);
  it("synchronizes two clients, validates fire/reload, reconnects and cleans up leave", async () => {
    const f = await setup(),
      a = await f.client(f.ticket(0)),
      b = await f.client(f.ticket(1));
    for (const c of [a, b]) {
      await until(() => c.messages.find((m) => m.type === "welcome"));
      c.send({
        v: 2,
        type: "clientReady",
        mapId: "quarantine-yard",
        mapVersion: 2,
      });
    }
    await until(() =>
      b.messages.find((m) => m.type === "matchState" && m.state === "PLAYING"),
    );
    const match = service!.matches.get(f.reservation.matchId)!;
    const x = match.players[0]!.state.position.x;
    for (let seq = 1; seq <= 10; seq++) {
      a.send({ ...neutralInput(seq, match.tick + 1), x: 1 });
      await sleep(36);
    }
    expect(
      await until(() => {
        const last = b.messages
          .filter((m) => m.type === "worldSnapshot")
          .at(-1);
        return last?.type === "worldSnapshot" &&
          last.snapshot.players[0]!.position.x > x + 0.3
          ? true
          : undefined;
      }),
    ).toBe(true);
    a.send(neutralInput(11, 999999));
    await until(() => a.messages.find((m) => m.type === "movementCorrection"));
    Object.assign(match.players[0]!.state.position, { x: -7, y: 0.015, z: 14 });
    a.send({ v: 2, type: "fire", seq: 1, tick: match.tick, yaw: 0, pitch: 0 });
    expect(
      await until(() =>
        a.messages.find((m) => m.type === "shotConfirmed" && m.seq === 1),
      ),
    ).toMatchObject({ targetId: "plate-a", weapon: { magazine: 29 } });
    a.send({ v: 2, type: "reload", seq: 1 });
    await until(() =>
      a.messages.find(
        (m) => m.type === "weaponState" && m.event === "reloadCompleted",
      ),
    );
    expect(match.players[0]!.state.weapon).toMatchObject({
      magazine: 30,
      reserve: 119,
      reloadAt: 0,
    });
    const before = structuredClone(match.players[0]!.state);
    a.ws.terminate();
    await until(() => (match.state === "RECONNECTING" ? true : undefined));
    const resumed = await f.client(f.ticket(0));
    const welcome = await until(() =>
      resumed.messages.find((m) => m.type === "welcome"),
    );
    expect(welcome).toMatchObject({ playerId: "pa", slot: 0 });
    if (welcome.type !== "welcome") throw new Error("Expected welcome");
    expect(welcome.snapshot.players[0]!.weapon).toEqual(before.weapon);
    resumed.send({
      v: 2,
      type: "clientReady",
      mapId: "quarantine-yard",
      mapVersion: 2,
    });
    await until(() => (match.state === "PLAYING" ? true : undefined));
    for (let seq = 2; seq < 16; seq++)
      resumed.send({
        v: 2,
        type: "fire",
        seq,
        tick: match.tick,
        yaw: 0,
        pitch: 0,
      });
    await until(() =>
      resumed.messages.find(
        (m) => m.type === "connectionWarning" && m.code === "RATE_LIMITED",
      ),
    );
    expect(match.players.every((p) => p.state.health === 100)).toBe(true);
    resumed.send({ v: 2, type: "leaveMatch" });
    await until(() => (match.state === "ENDED" ? true : undefined));
    await until(() => (f.lifecycle.includes("ENDED") ? true : undefined));
  }, 15000);
});
