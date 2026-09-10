// @vitest-environment node
import { afterEach, expect, it } from "vitest";
import { WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { createGameplayService } from "../server";
import {
  serverMessageSchema,
  type Reservation,
  type ServerMessage,
} from "../../../src/game/shared/protocol";
import { tokenTimes, signToken } from "../../../src/game/shared/tokens";
import { SIMULATION, LIMITS } from "../../../src/game/shared/config";
import { accelerated } from "./test-fixture";
const joinSecret = "pve-integration-join-key-at-least-32",
  controlSecret = "pve-integration-control-key-at-least-32",
  origin = "http://localhost:3100";
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
async function until<T>(read: () => T | undefined, timeout = 6000): Promise<T> {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = read();
    if (value !== undefined) return value;
    await sleep(20);
  }
  throw new Error("PvE network condition did not converge");
}
let service: Awaited<ReturnType<typeof createGameplayService>> | undefined;
const clients: WebSocket[] = [];
afterEach(async () => {
  for (const ws of clients) ws.terminate();
  clients.length = 0;
  await service?.close();
  service = undefined;
});
it("replicates five-wave PvE, damage, held revival and reconnect over two authorized WebSockets", async () => {
  service = await createGameplayService({
    joinSecret,
    controlSecret,
    origins: [origin],
    simulation: { ...SIMULATION, countdownMs: 100 },
    pve: { ...accelerated, rules: { ...accelerated.rules, bleedOutMs: 15000 } },
    lifecycle: async () => {},
  });
  await new Promise<void>((resolve) =>
    service!.http.listen(0, "127.0.0.1", resolve),
  );
  const address = service.http.address();
  if (!address || typeof address === "string") throw new Error("No test port");
  const url = `http://127.0.0.1:${address.port}`,
    wsUrl = `ws://127.0.0.1:${address.port}/gameplay`;
  const { serverEpoch } = await (await fetch(`${url}/health`)).json();
  const reservation: Reservation = {
    matchId: randomUUID(),
    roomId: "room",
    runtimeId: "runtime",
    serverEpoch,
    createdAt: Date.now(),
    players: [
      { userId: "a", playerId: "pa", name: "Alpha", kind: "USER", slot: 0 },
      { userId: "b", playerId: "pb", name: "Bravo", kind: "GUEST", slot: 1 },
    ],
  };
  expect(
    (
      await fetch(`${url}/control`, {
        method: "POST",
        body: signToken(
          {
            ...tokenTimes(),
            aud: "twoplayer-control",
            action: "reserve",
            reservation,
          },
          controlSecret,
        ),
      })
    ).ok,
  ).toBe(true);
  async function connect(slot: 0 | 1) {
    const ws = new WebSocket(wsUrl, { origin }),
      messages: ServerMessage[] = [];
    clients.push(ws);
    ws.on("message", (raw) =>
      messages.push(serverMessageSchema.parse(JSON.parse(raw.toString()))),
    );
    ws.on("error", () => {});
    await new Promise<void>((resolve) => ws.once("open", resolve));
    const send = (m: unknown) => ws.send(JSON.stringify(m));
    send({
      v: 2,
      type: "join",
      token: signToken(
        {
          ...tokenTimes(),
          ...reservation.players[slot],
          aud: "twoplayer-gameplay",
          matchId: reservation.matchId,
          roomId: "room",
          runtimeId: "runtime",
        },
        joinSecret,
      ),
    });
    const welcome = await until(() =>
      messages.find((m) => m.type === "welcome"),
    );
    send({
      v: 2,
      type: "clientReady",
      mapId: "quarantine-yard",
      mapVersion: 2,
    });
    return { ws, messages, send, welcome };
  }
  const a = await connect(0),
    b = await connect(1),
    match = service.matches.get(reservation.matchId)!;
  await until(() => (match.pve.entities.alive > 0 ? true : undefined));
  for (const p of match.players) p.state.protectedUntil = Date.now() + 60000;
  await until(() =>
    a.messages.some(
      (m) => m.type === "worldSnapshot" && m.snapshot.pve.zombies.length,
    ) &&
    b.messages.some(
      (m) => m.type === "worldSnapshot" && m.snapshot.pve.zombies.length,
    )
      ? true
      : undefined,
  );
  const common = a.messages
    .filter((m) => m.type === "worldSnapshot")
    .find(
      (m) =>
        m.snapshot.pve.zombies.length > 0 &&
        b.messages.some(
          (n) =>
            n.type === "worldSnapshot" && n.snapshot.tick === m.snapshot.tick,
        ),
    );
  expect(common).toBeDefined();
  const other = b.messages.find(
    (m) =>
      m.type === "worldSnapshot" &&
      common?.type === "worldSnapshot" &&
      m.snapshot.tick === common.snapshot.tick,
  );
  if (common?.type !== "worldSnapshot" || other?.type !== "worldSnapshot")
    throw new Error("Expected matching snapshots");
  expect(common.snapshot.pve.zombies).toEqual(other.snapshot.pve.zombies);
  const p = match.players[0]!.state,
    teammate = match.players[1]!.state;
  const z = match.pve.entities.spawn(
    "walker",
    { x: p.position.x, y: 0.04, z: p.position.z - 4 },
    match.pve.waves.config,
    Date.now(),
    match.tick,
  );
  a.send({ v: 2, type: "fire", seq: 1, tick: match.tick, yaw: 0, pitch: 0 });
  const confirmed = await until(() =>
    a.messages.find(
      (m) => m.type === "shotConfirmed" && m.zombieHit?.id === z.id,
    ),
  );
  expect(confirmed).toMatchObject({
    zombieHit: { region: "head" },
    weapon: { magazine: 29 },
  });
  const afterHit = z.health;
  a.send({ v: 2, type: "fire", seq: 1, tick: match.tick, yaw: 0, pitch: 0 });
  await sleep(80);
  expect(z.health).toBe(afterHit);
  teammate.position.x = p.position.x + 1;
  p.protectedUntil = 0;
  match.pve.life.damage(p, 100, Date.now(), teammate.position);
  await until(() =>
    b.messages.find(
      (m) =>
        m.type === "worldSnapshot" && m.snapshot.players[0]!.life === "DOWNED",
    ),
  );
  b.send({ v: 2, type: "beginRevive", targetId: p.id, seq: 1 });
  await until(() => match.pve.revive.current ?? undefined);
  b.send({ v: 2, type: "cancelRevive", seq: 2 });
  await until(() => (match.pve.revive.current === null ? true : undefined));
  b.send({ v: 2, type: "beginRevive", targetId: p.id, seq: 3 });
  await sleep(250);
  b.send({ v: 2, type: "beginRevive", targetId: p.id, seq: 4 });
  await until(() => (p.life === "ALIVE" ? true : undefined));
  expect(p.health).toBe(45);
  await until(() =>
    b.messages.find(
      (m) => m.type === "pveEvent" && m.event.kind === "reviveCompleted",
    ),
  );
  expect(
    b.messages.filter(
      (m) => m.type === "pveEvent" && m.event.kind === "reviveCompleted",
    ),
  ).toHaveLength(1);
  const saved = structuredClone(p.weapon),
    waveNumber = match.pve.waves.state.number;
  a.ws.terminate();
  await until(() => (!p.connected ? true : undefined));
  const resumed = await connect(0);
  expect(resumed.welcome.snapshot.players[0]!.weapon).toEqual(saved);
  expect(resumed.welcome.snapshot.pve.wave.number).toBe(waveNumber);
  expect(resumed.welcome.snapshot.pve.zombies.length).toBeGreaterThan(0);
  for (const player of match.players)
    player.state.protectedUntil = Date.now() + 60000;
  const clear = setInterval(() => {
    for (const enemy of match.pve.entities.entities)
      while (enemy.health > 0)
        match.pve.damage.apply(enemy, "head", Date.now(), match.tick);
  }, 40);
  try {
    await until(
      () =>
        match.pve.waves.state.state === "PHASE_COMPLETE" ? true : undefined,
      20000,
    );
  } finally {
    clearInterval(clear);
  }
  expect(match.pve.waves.state.number).toBe(5);
  expect(match.state).toBe("ENDED");
  await sleep(100);
  expect(
    b.messages.some(
      (m) => m.type === "waveStateChanged" && m.wave.state === "PHASE_COMPLETE",
    ),
  ).toBe(true);
  match.endedAt = Date.now() - LIMITS.leaseMs - 100;
  await until(() =>
    !service!.matches.has(reservation.matchId) ? true : undefined,
  );
  expect(match.pve.entities.entities).toHaveLength(0);
}, 30000);
