/* Development-only authority fixtures. This file is excluded from the gameplay build.
 * Run with NODE_ENV=test; it never installs a handler on the production server. */
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createGameplayService } from "../dist/game-server/services/game-server/server.js";
import { WAVES } from "../dist/game-server/services/game-server/pve/waves.js";
import {
  PVE_RULES,
  ZOMBIES,
} from "../dist/game-server/services/game-server/pve/definitions.js";
import {
  signToken,
  tokenTimes,
} from "../dist/game-server/src/game/shared/tokens.js";
if (process.env.NODE_ENV !== "test")
  throw new Error("This harness is for NODE_ENV=test only");
const joinSecret = randomBytes(32).toString("hex"),
  controlSecret = randomBytes(32).toString("hex");
const port = 3100,
  gamePort = 8080,
  fixturePort = 8092,
  base = `http://127.0.0.1:${port}`;
const fixtureKey = process.env.PVE_FIXTURE_KEY;
if (!fixtureKey || fixtureKey.length < 24)
  throw new Error("Set a private, temporary PVE_FIXTURE_KEY for local tests");
const service = await createGameplayService({
  joinSecret,
  controlSecret,
  origins: [base, `http://localhost:${port}`],
  pve: {
    seed: 4533,
    rules: { ...PVE_RULES, reviveMs: 1500, bleedOutMs: 15000 },
    waves: WAVES.map((w) => ({
      ...w,
      budget: Math.max(
        3,
        w.guaranteed.reduce((n, a) => n + ZOMBIES.get(a).cost, 0),
      ),
      interval: [300, 300],
      initialDelayMs: 1000,
      intermissionMs: 3500,
    })),
  },
  async lifecycle(matchId, runtimeId, state, outcome) {
    const response = await fetch(`${base}/api/gameplay/internal`, {
      method: "POST",
      body: signToken(
        {
          ...tokenTimes(),
          aud: "twoplayer-lifecycle",
          matchId,
          runtimeId,
          state,
          ...(outcome ? { outcome } : {}),
        },
        controlSecret,
      ),
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Lifecycle unavailable");
  },
});
service.http.listen(gamePort, "127.0.0.1");
let clearing = null;
const fixtures = createServer(async (req, res) => {
  if (
    req.headers.authorization !== `Bearer ${fixtureKey}` ||
    req.method !== "POST"
  ) {
    res.writeHead(403);
    res.end();
    return;
  }
  let body = "";
  for await (const chunk of req) {
    body += chunk;
    if (body.length > 1024) {
      res.writeHead(413);
      res.end();
      return;
    }
  }
  try {
    const { matchId, action } = JSON.parse(body),
      match = service.matches.get(matchId);
    if (!match) throw new Error("Unknown fixture match");
    const sim = match.pve,
      players = match.players.map((p) => p.state),
      now = Date.now();
    if (action === "protect")
      for (const p of players) p.protectedUntil = now + 300000;
    else if (action === "combat") {
      for (const p of players) p.protectedUntil = now + 300000;
      const p = players[0];
      Object.assign(p.position, { x: -3, y: 0.04, z: 14 });
      p.velocity.x = p.velocity.z = 0;
      sim.entities.spawn(
        "walker",
        { x: -3, y: 0.04, z: 10 },
        sim.waves.config,
        now,
        match.tick,
      );
    } else if (action === "down") {
      Object.assign(players[0].position, { x: -3, y: 0.04, z: 14 });
      Object.assign(players[1].position, { x: -2, y: 0.04, z: 14 });
      players[0].protectedUntil = 0;
      players[1].protectedUntil = now + 300000;
      if (!sim.life.damage(players[0], 100, now, players[1].position)) {
        res.writeHead(409, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            life: players[0].life,
            connected: players[0].connected,
            ready: players[0].ready,
            state: match.state,
          }),
        );
        return;
      }
    } else if (action === "bleed") players[0].bleedOutAt = now + 700;
    else if (action === "stress") {
      for (const p of players) p.protectedUntil = now + 300000;
      const types = ["walker", "runner", "spitter", "brute", "screamer"];
      for (let i = 0; sim.entities.alive < 24 && i < 48; i++) {
        const archetype = types[i % 5],
          position = sim.spawning.select(
            ZOMBIES.get(archetype).radius,
            players,
            sim.entities.entities.filter((z) => z.health > 0),
            now,
          );
        if (position)
          sim.entities.spawn(archetype, position, WAVES[4], now, match.tick);
      }
    } else if (action === "clearWave" || action === "finish") {
      clearInterval(clearing);
      const wave = sim.waves.state.number;
      clearing = setInterval(() => {
        if (
          match.state === "ENDED" ||
          (action === "clearWave" && sim.waves.state.number !== wave)
        ) {
          clearInterval(clearing);
          clearing = null;
          return;
        }
        for (const z of sim.entities.entities)
          while (z.health > 0)
            sim.damage.apply(z, "head", Date.now(), match.tick);
      }, 60);
    } else if (action === "defeat")
      for (const p of players) {
        p.protectedUntil = 0;
        sim.life.damage(p, 100, now, p.position);
      }
    else throw new Error("Unknown fixture action");
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        ok: true,
        alive: sim.entities.alive,
        life: players[0].life,
        wave: sim.waves.state.state,
      }),
    );
  } catch {
    res.writeHead(400);
    res.end();
  }
});
fixtures.listen(fixturePort, "127.0.0.1");
const env = {
  ...process.env,
  NODE_ENV: "development",
  TWOPLAYER_LOCAL_BUILD: "1",
  AUTH_MODE: "development",
  REALTIME_PROVIDER: "local",
  NEXT_PUBLIC_APP_URL: base,
  GAMEPLAY_JOIN_SECRET: joinSecret,
  GAMEPLAY_CONTROL_SECRET: controlSecret,
  GAMEPLAY_SERVER_HTTP_URL: `http://127.0.0.1:${gamePort}`,
  GAMEPLAY_WS_URL: `ws://127.0.0.1:${gamePort}/gameplay`,
};
delete env.DATABASE_URL;
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    "dev",
    "--webpack",
    "-p",
    String(port),
    "--hostname",
    "127.0.0.1",
  ],
  { env, stdio: "inherit", windowsHide: true },
);
async function stop() {
  clearInterval(clearing);
  web.kill();
  fixtures.close();
  await service.close();
  process.exit(0);
}
process.once("SIGTERM", () => void stop());
process.once("SIGINT", () => void stop());
console.log("Local Phase 5 browser harness starting at http://127.0.0.1:3100");
