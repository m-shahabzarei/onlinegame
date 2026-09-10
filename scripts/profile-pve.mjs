/* Trusted, offline stress harness. No test controls are exposed by the production service. */
import { performance } from "node:perf_hooks";
import { initPhysics } from "../dist/game-server/src/game/shared/physics.js";
import { MatchInstance } from "../dist/game-server/services/game-server/match.js";
import { neutralInput } from "../dist/game-server/src/game/shared/protocol.js";
import { tokenTimes } from "../dist/game-server/src/game/shared/tokens.js";
import { WAVES } from "../dist/game-server/services/game-server/pve/waves.js";
import { ZOMBIES } from "../dist/game-server/services/game-server/pve/definitions.js";
await initPhysics();
let now = 1000,
  bytes = 0,
  messages = 0,
  maxSnapshotBytes = 0,
  attacks = 0,
  damage = 0,
  shots = 0;
const reservation = {
  matchId: "stress",
  roomId: "room",
  runtimeId: "runtime",
  serverEpoch: "epoch",
  createdAt: now,
  players: [
    { userId: "a", playerId: "a", name: "Alpha", kind: "USER", slot: 0 },
    { userId: "b", playerId: "b", name: "Bravo", kind: "GUEST", slot: 1 },
  ],
};
const match = new MatchInstance(
  reservation,
  () => now,
  () => {},
  undefined,
  { seed: 9385 },
);
const peers = reservation.players.map(() => ({
  send(m) {
    const size = Buffer.byteLength(JSON.stringify(m));
    bytes += size;
    messages++;
    if (m.type === "worldSnapshot")
      maxSnapshotBytes = Math.max(maxSnapshotBytes, size);
    if (m.type === "pveEvent" && m.event.kind === "zombieAttackResolved")
      attacks++;
    if (m.type === "pveEvent" && m.event.kind === "playerDamaged") damage++;
    if (m.type === "shotConfirmed") shots++;
  },
  close() {},
}));
reservation.players.forEach((p, i) =>
  match.join(
    {
      ...p,
      ...tokenTimes(now),
      aud: "twoplayer-gameplay",
      matchId: "stress",
      roomId: "room",
      runtimeId: "runtime",
    },
    peers[i],
  ),
);
reservation.players.forEach((p, i) =>
  match.command(p.playerId, peers[i], {
    v: 2,
    type: "clientReady",
    mapId: "quarantine-yard",
    mapVersion: 2,
  }),
);
while (match.state !== "PLAYING") {
  now += 1000 / 30;
  match.step();
}
const archetypes = ["walker", "runner", "spitter", "brute", "screamer"];
let spawned = 0;
function populate() {
  while (match.pve.entities.alive < 24) {
    const archetype = archetypes[spawned % 5],
      d = ZOMBIES.get(archetype);
    const position = match.pve.spawning.select(
      d.radius,
      match.players.map((p) => p.state),
      match.pve.entities.entities.filter((z) => z.health > 0),
      now,
    );
    if (!position) break;
    match.pve.entities.spawn(archetype, position, WAVES[4], now, match.tick);
    spawned++;
  }
}
populate();
const times = [],
  ai = [],
  nav = [],
  memory = [];
let minAlive = 24,
  maxAlive = 0,
  maxRequestsPerTick = 0,
  overBudgetTicks = 0,
  consecutiveOverBudget = 0,
  maxConsecutiveOverBudget = 0;
const shotSeq = [0, 0];
try {
  for (let i = 1; i <= 9300; i++) {
    now += 1000 / 30;
    // Keep the stress workload alive; actual attack validation and damage still execute.
    for (const p of match.players) {
      p.state.health = 100;
      p.state.life = "ALIVE";
      p.state.weapon.reserve = 120;
    }
    const start = performance.now(),
      beforePaths = match.pve.navigation.requests;
    for (let slot = 0; slot < 2; slot++) {
      const p = match.players[slot].state;
      match.command(p.id, peers[slot], {
        ...neutralInput(i, match.tick + 1),
        x: Math.floor(i / 90) % 2 ? 1 : -1,
      });
      const target = match.pve.entities.entities.find((z) => z.health > 0);
      if (target && i % 6 === slot) {
        if (!p.weapon.magazine) p.weapon.magazine = 30;
        const dx = target.position.x - p.position.x,
          dz = target.position.z - p.position.z;
        match.command(p.id, peers[slot], {
          v: 2,
          type: "fire",
          seq: ++shotSeq[slot],
          tick: match.tick,
          viewTick: Math.max(0, match.tick - 3),
          yaw: Math.atan2(-dx, -dz),
          pitch: 0,
        });
      }
    }
    match.step();
    const duration = performance.now() - start;
    maxRequestsPerTick = Math.max(
      maxRequestsPerTick,
      match.pve.navigation.requests - beforePaths,
    );
    populate();
    if (match.state !== "PLAYING")
      throw new Error(`Unexpected stress terminal state: ${match.state}`);
    minAlive = Math.min(minAlive, match.pve.entities.alive);
    maxAlive = Math.max(maxAlive, match.pve.entities.alive);
    if (i > 300) {
      if (duration > 1000 / 30) {
        overBudgetTicks++;
        consecutiveOverBudget++;
        maxConsecutiveOverBudget = Math.max(
          maxConsecutiveOverBudget,
          consecutiveOverBudget,
        );
      } else consecutiveOverBudget = 0;
      times.push(duration);
      ai.push(match.pve.metrics.aiMs);
      nav.push(match.pve.metrics.navigationMs);
    }
    if (i % 900 === 0) {
      global.gc?.();
      memory.push({
        simulatedSeconds: i / 30,
        heapMB: process.memoryUsage().heapUsed / 1048576,
        rssMB: process.memoryUsage().rss / 1048576,
      });
    }
  }
  const summary = (values) => {
    values.sort((a, b) => a - b);
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      p95: values[Math.floor(values.length * 0.95)],
      p99: values[Math.floor(values.length * 0.99)],
      max: values.at(-1),
    };
  };
  console.log(
    JSON.stringify(
      {
        scenario:
          "two players, 24 mixed zombies, navigation, attacks, shooting, damage and JSON replication",
        simulatedSeconds: 310,
        measuredTicks: times.length,
        overBudgetTicks,
        maxConsecutiveOverBudget,
        minAlive,
        maxAlive,
        spawned,
        tickMs: summary(times),
        aiMs: summary(ai),
        navigationMs: summary(nav),
        maxRequestsPerTick,
        pathRequests: match.pve.navigation.requests,
        failedPaths: match.pve.navigation.failed,
        spawnFailures: match.pve.spawning.failures,
        maxSnapshotBytes,
        outboundBytesPerSecondPerClient: bytes / 310 / 2,
        outboundMessagesPerSecondPerClient: messages / 310 / 2,
        attacks: attacks / 2,
        playerDamageEvents: damage / 2,
        shots: shots / 2,
        memory,
        note: "Trusted harness restores health/ammo and replaces killed zombies to sustain concurrency; it does not represent a human playtest or browser GPU measurement.",
      },
      null,
      2,
    ),
  );
} finally {
  match.dispose();
}
