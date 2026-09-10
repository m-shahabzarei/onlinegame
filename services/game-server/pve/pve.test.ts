// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { initPhysics } from "../../../src/game/shared/physics";
import { ZombieAI, waveTerminal } from "../../../src/game/shared/pve";
import {
  neutralInput,
  serverMessageSchema,
  clientMessageSchema,
} from "../../../src/game/shared/protocol";
import {
  PVE_RULES,
  ZombieDefinitionRegistry,
  AttackKind,
  rulesSchema,
} from "./definitions";
import { accelerated, fixture } from "./test-fixture";
import { DifficultySystem, validateWaves, WAVES, WaveDirector } from "./waves";
import {
  NavigationSystem,
  groundHeight,
  navigable,
  lineOfSight,
} from "./navigation";
import { zombieTransition } from "./entities";
import { eligiblePlayer } from "./targeting";
import { seededRandom } from "./spawning";
beforeAll(initPhysics);
const withMatch = (
  work: (f: ReturnType<typeof fixture>) => void,
  fast = false,
) => {
  const f = fixture(fast ? accelerated : {});
  try {
    f.start();
    work(f);
  } finally {
    f.match.dispose();
  }
};

describe("validated Phase 5 configuration and wave accounting", () => {
  it("has exactly five distinct archetypes, bounded difficulty and five numbered waves", () => {
    expect(new ZombieDefinitionRegistry().get("brute").health).toBe(220);
    expect(() => new ZombieDefinitionRegistry([])).toThrow();
    expect(WAVES).toHaveLength(5);
    for (const w of WAVES) {
      expect(w.health).toBeLessThanOrEqual(1.4);
      expect(w.cap).toBeLessThanOrEqual(24);
    }
    expect(DifficultySystem.stats("runner", WAVES[4]!).speed).toBeLessThan(4.1);
  });
  it.each([
    (w: typeof WAVES) => w.slice(0, 4),
    (w: typeof WAVES) => w.map((x) => ({ ...x, number: 1 })),
    (w: typeof WAVES) => w.map((x) => ({ ...x, health: 99 })),
    (w: typeof WAVES) => w.map((x) => ({ ...x, cap: 25 })),
    (w: typeof WAVES) => w.map((x) => ({ ...x, interval: [900, 100] })),
    (w: typeof WAVES) => w.map((x) => ({ ...x, weights: [] })),
  ])("rejects invalid wave configuration", (change) =>
    expect(() => validateWaves(change(WAVES))).toThrow(),
  );
  it("validates revive, spawn and rewind limits", () => {
    expect(
      rulesSchema.safeParse({ ...PVE_RULES, rewindMs: 1000 }).success,
    ).toBe(false);
    expect(rulesSchema.safeParse({ ...PVE_RULES, reviveMs: 0 }).success).toBe(
      false,
    );
    expect(
      rulesSchema.safeParse({ ...PVE_RULES, spawnAttempts: 1000 }).success,
    ).toBe(false);
  });
  it("prevents duplicate or invalid wave transitions and refuses early clear", () => {
    const changes: string[] = [],
      w = new WaveDirector(seededRandom(1), (s) => changes.push(s.state));
    w.countdown(100);
    w.countdown(100);
    expect(changes).toEqual(["COUNTDOWN"]);
    expect(() => w.change("PHASE_COMPLETE")).toThrow();
    w.update(101, 0);
    expect(w.state.number).toBe(1);
    expect(w.canClear()).toBe(false);
    w.update(2200, 0);
    expect(w.state.scheduled).toBe(1);
    expect(w.queue.length).toBe(1);
    expect(w.canClear()).toBe(false);
    w.spawned();
    expect(w.state.alive).toBe(1);
    expect(w.canClear()).toBe(false);
  });
  // These bounded simulations advance hundreds of ticks on shared CI hosts.
  it(
    "queues pressure behind concurrency without losing scheduled enemies",
    () =>
      withMatch((f) => {
        const { pve } = f.match;
        for (const p of f.match.players) p.state.protectedUntil = 999999;
        f.advance(24000);
        expect(pve.entities.alive).toBe(WAVES[0]!.cap);
        expect(pve.waves.state.scheduled).toBe(8);
        expect(pve.waves.queue.length).toBe(4);
        expect(pve.waves.state.state).toBe("ACTIVE");
      }),
    15000,
  );
  it("completes exactly five waves, accounts reinforcements and never starts Wave 6", () =>
    withMatch((f) => {
      for (const p of f.match.players) p.state.protectedUntil = 999999;
      for (
        let i = 0;
        i < 1800 && !waveTerminal(f.match.pve.waves.state.state);
        i++
      ) {
        if (f.match.pve.waves.state.number === 5)
          f.match.pve.waves.reinforce(2);
        f.clear();
        f.advance(34);
      }
      const state = f.match.pve.waves.state;
      expect(state.state).toBe("PHASE_COMPLETE");
      expect(state.number).toBe(5);
      expect(state.reinforcements).toBe(4);
      expect(state.defeated).toBe(state.planned + 4);
      f.advance(60000);
      expect(state.number).toBe(5);
      expect(f.match.outcome).toMatchObject({
        result: "PHASE_COMPLETE",
        completedWaves: 5,
      });
      expect(f.transitions.filter((x) => x === "ENDED")).toHaveLength(1);
    }, true));
});

describe("navigation, spawning and targeting", () => {
  it("derives deterministic bounded navigation and traverses the existing ramp", () => {
    const a = new NavigationSystem(),
      b = new NavigationSystem();
    try {
      expect(a.nodes).toEqual(b.nodes);
      expect(a.nodes.length).toBeLessThanOrEqual(1209);
      const path = a.path(
        { x: -11, y: 0.04, z: 6 },
        { x: -11, y: 2.04, z: -5 },
      );
      expect(path.length).toBeGreaterThan(3);
      expect(a.nodes[path.at(-1)!]!.position.y).toBeGreaterThan(1.9);
      expect(groundHeight(-11, 2)).toBeGreaterThan(0.5);
      for (let i = 1; i < path.length; i++)
        expect(
          a.segment(
            a.nodes[path[i - 1]!]!.position,
            a.nodes[path[i]!]!.position,
          ),
        ).toBe(true);
    } finally {
      a.dispose();
      b.dispose();
    }
  });
  it("routes around the divider, rejects solid and out-of-bounds space and returns bounded failure", () => {
    const nav = new NavigationSystem();
    try {
      expect(navigable(0, -7)).toBe(false);
      expect(navigable(99, 0)).toBe(false);
      expect(navigable(-7, -16)).toBe(false);
      expect(
        nav.segment({ x: -7, y: 0.04, z: -14 }, { x: -7, y: 0.04, z: -18 }),
      ).toBe(false);
      expect(nav.segment({ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: -9 })).toBe(
        false,
      );
      const path = nav.path({ x: 0, y: 0, z: -5 }, { x: 0, y: 0, z: -10 });
      expect(path.some((i) => Math.abs(nav.nodes[i]!.position.x) >= 4)).toBe(
        true,
      );
      expect(nav.path({ x: 100, y: 0, z: 100 }, { x: 0, y: 0, z: 0 })).toEqual(
        [],
      );
      expect(nav.failed).toBe(1);
    } finally {
      nav.dispose();
    }
  });
  it("validates distance, occupancy, bounds, zones and reachability for spawn candidates", () =>
    withMatch((f) => {
      const { spawning } = f.match.pve,
        players = f.match.players.map((p) => p.state);
      const p = spawning.select(0.58, players, [], f.now())!;
      expect(p).not.toBeNull();
      expect(spawning.valid(p, 0.58, players, [])).toBe(true);
      expect(
        spawning.valid(p, 0.58, players, [{ position: p, radius: 0.58 }]),
      ).toBe(false);
      expect(spawning.valid(players[0]!.position, 0.34, players, [])).toBe(
        false,
      );
      expect(spawning.valid({ x: 100, y: 0, z: 100 }, 0.34, players, [])).toBe(
        false,
      );
      expect(spawning.valid({ ...p, y: 20 }, 0.34, players, [])).toBe(false);
      expect(spawning.valid({ x: 0, y: 0, z: 0 }, 0.34, players, [])).toBe(
        false,
      );
      expect(spawning.attempts).toBeLessThanOrEqual(PVE_RULES.spawnAttempts);
    }));
  it("scores occluded/out-of-view spawns ahead of exposed candidates and rotates reuse", () =>
    withMatch((f) => {
      const { spawning } = f.match.pve,
        p = f.match.players[0]!.state;
      Object.assign(p.position, { x: 0, y: 0.04, z: 0 });
      p.yaw = 0;
      const hidden = spawning.score({ x: 0, y: 0.04, z: -15 }, [p]);
      const visible = spawning.score({ x: 7, y: 0.04, z: -15 }, [p]);
      expect(hidden).toBeGreaterThan(visible);
      const players = f.match.players.map((p) => p.state),
        first = spawning.select(0.34, players, [], f.now()),
        next = spawning.select(0.34, players, [], f.now());
      expect(first).not.toEqual(next);
    }));
  it("bounds spawn exhaustion and reports a controlled error", () =>
    withMatch((f) => {
      const spawning = f.match.pve.spawning;
      spawning.candidates.splice(0, spawning.candidates.length, {
        x: 100,
        y: 0,
        z: 100,
      });
      for (const p of f.match.players) p.state.protectedUntil = 999999;
      f.advance(16000);
      expect(spawning.attempts).toBeLessThanOrEqual(PVE_RULES.spawnAttempts);
      expect(spawning.consecutiveFailures).toBe(PVE_RULES.spawnFailureLimit);
      expect(f.match.pve.waves.state.state).toBe("ERROR");
      expect(f.match.state).toBe("ERROR");
    }));
  it("uses hysteresis, excludes ineligible targets and immediately invalidates them", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        players = f.match.players.map((p) => p.state);
      const z = sim.entities.spawn(
        "walker",
        { x: 0, y: 0.04, z: 10 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      z.targetId = players[0]!.id;
      const target = sim.ai.targeting.select(
        z,
        players,
        sim.entities.entities,
        f.now(),
      );
      expect(target?.id).toBe(players[0]!.id);
      players[0]!.life = "DOWNED";
      expect(
        sim.ai.targeting.select(z, players, sim.entities.entities, f.now())?.id,
      ).toBe(players[1]!.id);
      players[1]!.connected = false;
      expect(
        sim.ai.targeting.select(z, players, sim.entities.entities, f.now()),
      ).toBeUndefined();
      expect(z.targetId).toBe("");
      for (const p of players) expect(eligiblePlayer(p)).toBe(false);
    }));
  it(
    "keeps mixed moving zombies inside clear space without overlapping each other",
    () =>
      withMatch((f) => {
        const sim = f.match.pve;
        for (const p of f.match.players) p.state.protectedUntil = 999999;
        for (const [i, archetype] of (
          ["walker", "runner", "spitter", "brute", "screamer"] as const
        ).entries())
          sim.entities.spawn(
            archetype,
            { x: -4 + i * 2, y: 0.04, z: -14 },
            sim.waves.config,
            f.now(),
            f.match.tick,
          );
        for (let i = 0; i < 300; i++) {
          f.advance(34);
          for (const z of sim.entities.entities) {
            expect(navigable(z.position.x, z.position.z, z.radius)).toBe(true);
            for (const other of sim.entities.entities)
              if (z !== other && z.health && other.health)
                expect(
                  Math.hypot(
                    z.position.x - other.position.x,
                    z.position.z - other.position.z,
                  ),
                ).toBeGreaterThanOrEqual(z.radius + other.radius - 0.001);
          }
        }
        expect(sim.navigation.requests).toBeLessThanOrEqual(
          f.match.tick * PVE_RULES.pathRequestsPerTick,
        );
      }),
    15000,
  );
  it("detects lack of progress, invalidates a failed path and recovers without teleporting", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        z = sim.entities.spawn(
          "walker",
          { x: 0, y: 0.04, z: 10 },
          sim.waves.config,
          f.now(),
          f.match.tick,
        );
      zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
      z.speed = 0;
      const before = { ...z.position };
      f.advance(3000);
      expect(sim.ai.stuckRecoveries).toBeGreaterThan(0);
      expect(z.stuck).toBeGreaterThan(0);
      expect(z.position).toEqual(before);
    }));
});

describe("server-owned attacks and rifle damage", () => {
  it.each(["walker", "runner", "brute"] as const)(
    "%s telegraphs, checks cooldown/range and applies melee once",
    (archetype) =>
      withMatch((f) => {
        const sim = f.match.pve,
          p = f.match.players[0]!.state;
        const z = sim.entities.spawn(
          archetype,
          { x: p.position.x, y: 0.04, z: p.position.z - 1 },
          sim.waves.config,
          f.now(),
          f.match.tick,
        );
        zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
        z.cooldownAt = f.now() + 1;
        expect(sim.attacks.start(z, p, f.now(), f.match.tick)).toBe(false);
        z.cooldownAt = 0;
        expect(sim.attacks.start(z, p, f.now(), f.match.tick)).toBe(true);
        expect(
          f.events[0]!.some(
            (m) =>
              m.type === "pveEvent" && m.event.kind === "zombieAttackTelegraph",
          ),
        ).toBe(true);
        expect(p.health).toBe(100);
        sim.attacks.resolve(
          z,
          f.match.players.map((p) => p.state),
          z.stateUntil,
          f.match.tick,
        );
        expect(p.health).toBe(100 - z.damage);
        const health = p.health;
        sim.attacks.resolve(
          z,
          f.match.players.map((p) => p.state),
          z.stateUntil + 5000,
          f.match.tick,
        );
        expect(p.health).toBe(health);
        expect(z.state).toBe(ZombieAI.Recovery);
        expect(() => zombieTransition(z, ZombieAI.Spawning, 0, 1)).toThrow();
      }),
  );
  it("melee fails when the target leaves range, becomes ineligible or a wall intervenes", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        p = f.match.players[0]!.state;
      const z = sim.entities.spawn(
        "walker",
        { x: p.position.x, y: 0.04, z: p.position.z - 1 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
      z.cooldownAt = 0;
      sim.attacks.start(z, p, f.now(), f.match.tick);
      p.position.x += 5;
      sim.attacks.resolve(
        z,
        f.match.players.map((p) => p.state),
        z.stateUntil,
        f.match.tick,
      );
      expect(p.health).toBe(100);
      zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
      z.cooldownAt = 0;
      p.life = "ELIMINATED";
      expect(sim.attacks.canStart(z, p, f.now())).toBe(false);
      p.life = "ALIVE";
      Object.assign(p.position, { x: 0, y: 0.04, z: -7.6 });
      Object.assign(z.position, { x: 0, y: 0.04, z: -6.4 });
      expect(sim.attacks.canStart(z, p, f.now())).toBe(false);
    }));
  it("Spitter commits an aim point, validates LOS, and can be dodged", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        p = f.match.players[0]!.state;
      const z = sim.entities.spawn(
        "spitter",
        { x: -3, y: 0.04, z: 4 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
      z.cooldownAt = 0;
      expect(sim.attacks.start(z, p, f.now(), f.match.tick)).toBe(true);
      expect(z.attackKind).toBe(AttackKind.Spit);
      p.position.x += 2;
      sim.attacks.resolve(
        z,
        f.match.players.map((p) => p.state),
        z.stateUntil,
        f.match.tick,
      );
      expect(p.health).toBe(100);
      zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
      z.cooldownAt = 0;
      sim.attacks.start(z, p, f.now(), f.match.tick);
      sim.attacks.resolve(
        z,
        f.match.players.map((p) => p.state),
        z.stateUntil,
        f.match.tick,
      );
      expect(p.health).toBe(84);
    }));
  it("Screamer can call only one nonrecursive package and reinforcement totals are bounded", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        p = f.match.players[0]!.state;
      sim.waves.state.number = 5;
      sim.waves.state.reinforcementLimit = 4;
      const z = sim.entities.spawn(
        "screamer",
        { x: -3, y: 0.04, z: 5 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      zombieTransition(z, ZombieAI.Chasing, 0, f.match.tick);
      z.cooldownAt = 0;
      expect(sim.attacks.start(z, p, f.now(), f.match.tick)).toBe(true);
      sim.attacks.resolve(
        z,
        f.match.players.map((p) => p.state),
        z.stateUntil,
        f.match.tick,
      );
      expect(z.calls).toBe(1);
      expect(sim.waves.queue).toEqual(["walker", "walker"]);
      expect(sim.attacks.kind(z)).toBe(AttackKind.Melee);
      for (let i = 0; i < 100; i++) sim.waves.reinforce(2);
      expect(sim.waves.state.reinforcements).toBe(4);
      expect(sim.waves.queue).toHaveLength(4);
    }));
  it("validates nearest head/body hits against short history and applies death idempotently", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        z = sim.entities.spawn(
          "walker",
          { x: 3, y: 0.04, z: 10 },
          sim.waves.config,
          f.now(),
          f.match.tick,
        );
      const head = sim.damage.hit(
        { x: 3, y: 1.615, z: 14 },
        { x: 0, y: 0, z: -1 },
        65,
        f.match.tick,
      )!;
      expect(head.region).toBe("head");
      sim.damage.apply(z, head.region, f.now(), f.match.tick);
      expect(z.health).toBe(15);
      const body = sim.damage.hit(
        { x: 3, y: 0.9, z: 14 },
        { x: 0, y: 0, z: -1 },
        65,
        f.match.tick,
      )!;
      expect(body.region).toBe("body");
      sim.damage.apply(z, body.region, f.now(), f.match.tick);
      expect(z.health).toBe(0);
      const defeated = sim.waves.state.defeated;
      expect(sim.damage.apply(z, "head", f.now(), f.match.tick)).toBe(false);
      expect(sim.waves.state.defeated).toBe(defeated);
      expect(
        sim.damage.hit(
          { x: 3, y: 1.615, z: 14 },
          { x: 0, y: 0, z: -1 },
          65,
          f.match.tick,
        ),
      ).toBeNull();
    }));
  it("rewinds hitboxes without moving live entities and never hits a future generation", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        z = sim.entities.spawn(
          "runner",
          { x: 3, y: 0.04, z: 10 },
          sim.waves.config,
          f.now(),
          f.match.tick,
        );
      const tick = f.match.tick;
      z.position.x = 6;
      sim.entities.record(z, tick + 1);
      expect(
        sim.damage.hit({ x: 3, y: 1.5, z: 14 }, { x: 0, y: 0, z: -1 }, 65, tick)
          ?.zombie.id,
      ).toBe(z.id);
      expect(z.position.x).toBe(6);
      expect(
        sim.damage.hit(
          { x: 3, y: 1.5, z: 14 },
          { x: 0, y: 0, z: -1 },
          65,
          tick - 1,
        ),
      ).toBeNull();
      for (let i = 0; i < 100; i++) sim.entities.record(z, i + 100);
      expect(z.historyCount).toBe(32);
      expect(z.history.length).toBe(128);
    }));
  it("uses the existing command ownership, ammo, duplicate and timestamp gates for zombie shots", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        p = f.match.players[0]!.state;
      Object.assign(p.position, { x: 3, y: 0.04, z: 14 });
      const z = sim.entities.spawn(
        "walker",
        { x: 3, y: 0.04, z: 10 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      const shot = {
        v: 3 as const,
        type: "fire" as const,
        triggerSeq: 1,
        seq: 1,
        tick: f.match.tick,
        viewTick: f.match.tick,
        yaw: 0,
        pitch: 0,
      };
      f.match.command(p.id, f.peers[0]!, shot);
      const health = z.health;
      expect(health).toBeLessThan(z.maxHealth);
      expect(p.weapon.magazine).toBe(29);
      f.match.command(p.id, f.peers[0]!, shot);
      expect(z.health).toBe(health);
      expect(p.weapon.magazine).toBe(29);
      f.match.command(p.id, f.peers[0]!, {
        ...shot,
        seq: 2,
        viewTick: f.match.tick + 100,
      });
      expect(p.weapon.magazine).toBe(29);
      expect(f.match.players[1]!.state.health).toBe(100);
    }));
  it("retains static-world occlusion before applying rifle damage", () =>
    withMatch((f) => {
      const sim = f.match.pve,
        p = f.match.players[0]!.state;
      Object.assign(p.position, { x: 0, y: 0.04, z: -4 });
      const z = sim.entities.spawn(
        "walker",
        { x: 0, y: 0.04, z: -10 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      f.match.command(p.id, f.peers[0]!, {
        v: 3,
        type: "fire",
        triggerSeq: 1,
        seq: 1,
        tick: f.match.tick,
        yaw: 0,
        pitch: 0,
      });
      expect(z.health).toBe(z.maxHealth);
      expect(
        lineOfSight(
          f.match.physics,
          { x: 0, y: 1, z: -4 },
          { x: 0, y: 1, z: -10 },
        ),
      ).toBe(false);
    }));
});

describe("life states, revive and reconnect", () => {
  it("lethal damage downs, disables weapons/movement and preserves authoritative bleed-out", () =>
    withMatch((f) => {
      const p = f.match.players[0]!.state,
        sim = f.match.pve;
      sim.life.damage(p, 100, f.now(), { x: 0, y: 0, z: 0 });
      expect(p.life).toBe("DOWNED");
      expect(p.health).toBe(0);
      expect(p.bleedOutAt).toBe(f.now() + PVE_RULES.bleedOutMs);
      const before = { ...p.position };
      f.match.command(p.id, f.peers[0]!, {
        ...neutralInput(1, f.match.tick),
        x: 1,
      });
      f.advance(34);
      expect(p.position).toEqual(before);
      expect(() =>
        f.match.command(p.id, f.peers[0]!, { v: 3, type: "reload", seq: 1 }),
      ).toThrow("NOT_PLAYING");
      expect(() =>
        f.match.command(p.id, f.peers[0]!, {
          v: 3,
          type: "fire",
          triggerSeq: 1,
          seq: 1,
          tick: f.match.tick,
          yaw: 0,
          pitch: 0,
        }),
      ).toThrow("NOT_PLAYING");
    }));
  it("validates a held revive, preserves its start, completes once and applies protection", () =>
    withMatch((f) => {
      const [a, b] = f.match.players.map((p) => p.state),
        sim = f.match.pve;
      b!.position.x = a!.position.x + 1;
      sim.life.damage(b!, 100, f.now(), a!.position);
      expect(sim.revive.begin(a!, b!, f.now())).toBe(true);
      const first = { ...sim.revive.current! };
      expect(sim.revive.begin(a!, b!, f.now() + 100)).toBe(true);
      expect(sim.revive.current).toEqual(first);
      sim.revive.update([a!, b!], f.now() + 499, true);
      expect(b!.life).toBe("DOWNED");
      sim.revive.update([a!, b!], f.now() + 500, true);
      expect(b!.life).toBe("ALIVE");
      expect(b!.health).toBe(45);
      expect(b!.bleedOutAt).toBe(0);
      sim.revive.update([a!, b!], f.now() + 600, true);
      expect(
        f.events[0]!.filter(
          (m) => m.type === "pveEvent" && m.event.kind === "reviveCompleted",
        ),
      ).toHaveLength(1);
      expect(sim.life.damage(b!, 100, f.now() + 700, a!.position)).toBe(false);
    }, true));
  it.each([
    "release",
    "range",
    "wall",
    "disconnect",
    "downed",
    "bleed",
    "inactive",
    "holdExpired",
  ])("cancels revive on %s", (cause) =>
    withMatch((f) => {
      const [a, b] = f.match.players.map((p) => p.state),
        sim = f.match.pve;
      b!.position.x = a!.position.x + 1;
      sim.life.damage(b!, 100, f.now(), a!.position);
      sim.revive.begin(a!, b!, f.now());
      if (cause === "release") sim.revive.cancel("Released", a!.id);
      if (cause === "range") a!.position.x += 10;
      if (cause === "wall") {
        Object.assign(a!.position, { x: 0, y: 0.04, z: -6 });
        Object.assign(b!.position, { x: 0, y: 0.04, z: -8 });
      }
      if (cause === "disconnect") a!.connected = false;
      if (cause === "downed") a!.life = "DOWNED";
      if (cause === "bleed") b!.bleedOutAt = f.now();
      sim.revive.update(
        [a!, b!],
        f.now() + (cause === "holdExpired" ? 800 : 100),
        cause !== "inactive",
      );
      expect(sim.revive.current).toBeNull();
      expect(b!.health).toBe(0);
    }),
  );
  it("rejects self revive, eliminated targets and trusted progress fields", () =>
    withMatch((f) => {
      const [a, b] = f.match.players.map((p) => p.state),
        revive = f.match.pve.revive;
      expect(revive.begin(a!, a!, f.now())).toBe(false);
      b!.life = "ELIMINATED";
      expect(revive.begin(a!, b!, f.now())).toBe(false);
      expect(
        clientMessageSchema.safeParse({
          v: 3,
          type: "beginRevive",
          targetId: b!.id,
          seq: 1,
          progress: 1,
        }).success,
      ).toBe(false);
    }));
  it("bleed-out eliminates, intermission returns once and preserves authoritative ammunition", () =>
    withMatch((f) => {
      const [a, b] = f.match.players.map((p) => p.state),
        sim = f.match.pve;
      a!.protectedUntil = 999999;
      b!.weapon.magazine = 7;
      b!.weapon.reserve = 13;
      sim.life.damage(b!, 100, f.now(), a!.position);
      f.advance(1100);
      expect(b!.life).toBe("ELIMINATED");
      for (
        let i = 0;
        i < 400 && sim.waves.state.state !== "INTERMISSION";
        i++
      ) {
        f.clear();
        f.advance(34);
      }
      expect(sim.waves.state.state).toBe("INTERMISSION");
      expect(b!.life).toBe("ALIVE");
      expect(b!.health).toBe(100);
      expect(b!.weapon).toMatchObject({
        magazine: 7,
        reserve: 13,
        reloadAt: 0,
      });
      expect(
        f.events[0]!.filter(
          (m) => m.type === "pveEvent" && m.event.detail === "RETURNED",
        ),
      ).toHaveLength(1);
    }, true));
  it("defeats two downed players and stops new attack damage or spawns", () =>
    withMatch((f) => {
      const sim = f.match.pve;
      for (const p of f.match.players)
        sim.life.damage(p.state, 100, f.now(), p.state.position);
      f.advance(34);
      expect(sim.waves.state.state).toBe("TEAM_DEFEATED");
      expect(f.match.state).toBe("ENDED");
      const count = f.events[0]!.length;
      f.advance(10000);
      expect(f.events[0]!.length).toBe(count);
      expect(sim.waves.queue).toHaveLength(0);
    }));
  it("holds bounded recovery pending, resumes on reconnect and never resets health/ammo/wave", () =>
    withMatch((f) => {
      const [a, b] = f.match.players.map((p) => p.state),
        sim = f.match.pve;
      b!.position.x = a!.position.x + 1;
      b!.health = 63;
      b!.weapon.magazine = 11;
      f.match.disconnect(b!.id, f.peers[1]!);
      sim.life.damage(a!, 100, f.now(), b!.position);
      f.advance(500);
      expect(sim.recoveryPending).toBe(true);
      const bleed = a!.bleedOutAt;
      f.match.join(f.claims(1), f.peers[1]!);
      f.ready(1);
      f.advance(34);
      expect(sim.recoveryPending).toBe(false);
      expect(b!.health).toBe(63);
      expect(b!.weapon.magazine).toBe(11);
      expect(a!.bleedOutAt).toBe(bleed);
      expect(sim.revive.begin(b!, a!, f.now())).toBe(true);
      for (const event of f.events[1]!)
        expect(serverMessageSchema.safeParse(event).success).toBe(true);
      const snapshot = f.match.snapshot();
      expect(snapshot.pve.wave.number).toBe(1);
      expect(snapshot.pve.revive).not.toBeNull();
      expect(JSON.stringify(snapshot)).not.toContain("userId");
      for (const zombie of snapshot.pve.zombies) {
        expect(zombie).not.toHaveProperty("targetId");
        expect(zombie).not.toHaveProperty("path");
      }
    }));
  it("does not extend recovery grace through repeated unready reconnects", () =>
    withMatch((f) => {
      const p = f.match.players[0]!.state;
      f.match.disconnect(f.match.players[1]!.state.id, f.peers[1]!);
      f.match.pve.life.damage(p, 100, f.now(), p.position);
      f.advance(500);
      f.match.join(f.claims(1), f.peers[1]!);
      f.advance(500);
      f.match.disconnect(f.match.players[1]!.state.id, f.peers[1]!);
      f.advance(501);
      expect(f.match.pve.waves.state.state).toBe("TEAM_DEFEATED");
    }));
  it("defeats after the only possible reviver's grace expires", () =>
    withMatch((f) => {
      const [a, b] = f.match.players.map((p) => p.state),
        sim = f.match.pve;
      f.match.disconnect(b!.id, f.peers[1]!);
      sim.life.damage(a!, 100, f.now(), b!.position);
      f.advance(1700);
      expect(sim.waves.state.state).toBe("TEAM_DEFEATED");
      expect(b!.life).toBe("ELIMINATED");
      expect(() => f.match.join(f.claims(1), f.peers[1]!)).toThrow(
        "MATCH_UNAVAILABLE",
      );
    }));
  it("serializes bounded reconnect state and clears all match resources", () => {
    const f = fixture();
    f.start();
    f.advance(3000);
    const before = f.match.snapshot();
    f.match.disconnect("pa", f.peers[0]!);
    f.match.join(f.claims(0), f.peers[0]!);
    const welcome = f.events[0]!.filter((m) => m.type === "welcome").at(-1)!;
    expect(welcome.snapshot.pve.zombies).toEqual(before.pve.zombies);
    expect(welcome.snapshot.players[0]!.weapon).toEqual(
      before.players[0]!.weapon,
    );
    expect(Buffer.byteLength(JSON.stringify(welcome))).toBeLessThan(32768);
    f.match.dispose();
    expect(f.match.pve.entities.entities).toHaveLength(0);
    expect(f.match.players.every((p) => !p.peer)).toBe(true);
  });
});
