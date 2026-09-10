// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { newLife, emptyPvE } from "./pve";
import { SPAWNS } from "./arena";
import {
  LIMITS,
  MOVEMENT,
  RIFLE,
  SIMULATION,
  simulationConfigSchema,
} from "./config";
import { terminalState, transition } from "./lifecycle";
import {
  ArenaPhysics,
  createMotion,
  enforceBounds,
  initPhysics,
} from "./physics";
import { PredictionBuffer, SnapshotBuffer, lerpAngle } from "./prediction";
import {
  clientMessageSchema,
  neutralInput,
  parseClientMessage,
  serverMessageSchema,
  type PlayerState,
  type WorldSnapshot,
} from "./protocol";
import { DEFAULT_SETTINGS, loadSettings, settingsSchema } from "./settings";
import {
  joinClaimsSchema,
  ReplayGuard,
  signToken,
  tokenTimes,
  verifyToken,
} from "./tokens";
import { FixedAccumulator, RateBudget } from "./time";
import {
  canDamage,
  completeReload,
  fireWeapon,
  newWeapon,
  reloadWeapon,
} from "./weapon";
beforeAll(initPhysics);
const secret = "unit-only-gameplay-key-32-characters";
const player = (): PlayerState => ({
  ...createMotion(SPAWNS[0]!),
  id: "p0",
  slot: 0,
  name: "Player",
  connected: true,
  ready: true,
  lastInput: 0,
  health: 100,
  ...newLife(),
  weapon: newWeapon(),
});
const snapshot = (tick: number, time: number, x: number): WorldSnapshot => ({
  tick,
  time,
  state: "PLAYING",
  startAt: 0,
  players: [{ ...player(), position: { x, y: 0, z: 0 } }],
  targets: [],
  pve: emptyPvE(),
});
describe("strict shared gameplay contract", () => {
  it("rejects invented position, health, damage, identity and hit fields", () => {
    for (const key of ["position", "health", "damage", "userId", "hit"]) {
      expect(
        clientMessageSchema.safeParse({ ...neutralInput(1, 1), [key]: 100 })
          .success,
      ).toBe(false);
    }
  });
  it("rejects malformed, incompatible, unknown and nonfinite commands", () => {
    expect(() => parseClientMessage("{")).toThrow("INVALID_MESSAGE");
    expect(() =>
      parseClientMessage('{"v":1,"type":"ping","sentAt":0}'),
    ).toThrow("PROTOCOL_MISMATCH");
    expect(
      clientMessageSchema.safeParse({ ...neutralInput(), yaw: Infinity })
        .success,
    ).toBe(false);
    expect(
      clientMessageSchema.safeParse({ v: 2, type: "damage" }).success,
    ).toBe(false);
  });
  it("roundtrips authoritative snapshots without private identities", () => {
    const value = { v: 2, type: "worldSnapshot", snapshot: snapshot(1, 10, 0) };
    expect(
      serverMessageSchema.parse(JSON.parse(JSON.stringify(value))),
    ).toEqual(value);
    expect(JSON.stringify(value)).not.toContain("userId");
  });
  it("validates rates and setting ranges", () => {
    expect(
      simulationConfigSchema.safeParse({ ...SIMULATION, snapshotRate: 17 })
        .success,
    ).toBe(false);
    expect(
      simulationConfigSchema.safeParse({ ...SIMULATION, inputRate: 60 })
        .success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...DEFAULT_SETTINGS, fov: 200 }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...DEFAULT_SETTINGS, volume: -1 }).success,
    ).toBe(false);
  });
  it("restores account motion/audio defaults and tolerates corrupt storage", () => {
    expect(
      loadSettings(
        { reducedMotion: true, soundEnabled: false },
        { getItem: () => "broken" },
        false,
      ),
    ).toMatchObject({ volume: 0, reducedMotion: true });
  });
});
describe("join credentials", () => {
  const claims = {
    ...tokenTimes(1000),
    aud: "twoplayer-gameplay" as const,
    matchId: "match",
    roomId: "room",
    runtimeId: "runtime",
    userId: "user",
    playerId: "player",
    name: "Guest",
    kind: "GUEST" as const,
    slot: 0 as const,
  };
  it("validates signature, audience, identity, slot and protocol", () => {
    expect(
      verifyToken(signToken(claims, secret), secret, joinClaimsSchema, 1001),
    ).toEqual(claims);
    for (const change of [
      { aud: "wrong" },
      { v: 1 },
      { slot: 4 },
      { kind: "fake" },
    ])
      expect(() =>
        verifyToken(
          signToken({ ...claims, ...change }, secret),
          secret,
          joinClaimsSchema,
          1001,
        ),
      ).toThrow("UNAUTHORIZED");
    expect(() =>
      verifyToken(
        signToken(claims, secret),
        secret + "x",
        joinClaimsSchema,
        1001,
      ),
    ).toThrow("UNAUTHORIZED");
  });
  it("rejects expired and overlong lifetime tickets", () => {
    expect(() =>
      verifyToken(
        signToken(claims, secret),
        secret,
        joinClaimsSchema,
        claims.exp,
      ),
    ).toThrow("TOKEN_EXPIRED");
    expect(() =>
      verifyToken(
        signToken({ ...claims, exp: 90000 }, secret),
        secret,
        joinClaimsSchema,
        1001,
      ),
    ).toThrow("UNAUTHORIZED");
  });
  it("consumes each ticket once and reclaims expired replay entries", () => {
    const guard = new ReplayGuard();
    guard.consume(claims.jti, 2000, 1000);
    expect(() => guard.consume(claims.jti, 2000, 1001)).toThrow("TOKEN_USED");
    expect(() => guard.consume(randomUUID(), 3000, 2001)).not.toThrow();
  });
});
describe("time and lifecycle", () => {
  it("allows readiness/countdown/play/reconnect and rejects invalid transitions", () => {
    expect(transition("WAITING_FOR_PLAYERS", "LOADING")).toBe("LOADING");
    expect(transition("LOADING", "COUNTDOWN")).toBe("COUNTDOWN");
    expect(transition("COUNTDOWN", "PLAYING")).toBe("PLAYING");
    expect(transition("RECONNECTING", "PLAYING")).toBe("PLAYING");
    expect(() => transition("WAITING_FOR_PLAYERS", "PLAYING")).toThrow();
    expect(terminalState("ENDED")).toBe(true);
    expect(() => transition("ENDED", "PLAYING")).toThrow();
  });
  it("accumulates fractional time and clamps tab stalls", () => {
    let ticks = 0;
    const a = new FixedAccumulator(1 / 30);
    a.advance(1 / 60, () => ticks++);
    expect(ticks).toBe(0);
    a.advance(1 / 60, () => ticks++);
    expect(ticks).toBe(1);
    a.advance(10, () => ticks++);
    expect(ticks).toBe(6);
    expect(a.droppedSeconds).toBeGreaterThan(9);
    a.reset();
    a.advance(NaN, () => ticks++);
    expect(ticks).toBe(6);
  });
  it("rate limits bursts and refills by elapsed wall time", () => {
    const b = new RateBudget(30, 2, 0);
    expect(b.consume(0)).toBe(true);
    expect(b.consume(0)).toBe(true);
    expect(b.consume(0)).toBe(false);
    expect(b.consume(100)).toBe(true);
  });
  it("forgives spaced transient violations but exhausts sustained flood tolerance", () => {
    const b = new RateBudget(
      LIMITS.violationRefillRate,
      LIMITS.violationBurst,
      0,
    );
    for (let second = 0; second < 60; second++) {
      expect(b.consume(second * 1000)).toBe(true);
    }
    let tolerated = 0;
    while (b.consume(60000)) tolerated++;
    expect(tolerated).toBe(LIMITS.violationBurst);
    expect(b.consume(60000)).toBe(false);
  });
});
describe("authoritative capsule movement", () => {
  function withWorld(work: (world: ArenaPhysics) => void) {
    const w = new ArenaPhysics(1 / 30);
    try {
      work(w);
    } finally {
      w.dispose();
    }
  }
  it("validates both distinct spawns and blocks cover spawns", () =>
    withWorld((w) => {
      expect(w.validSpawn(SPAWNS[0]!)).toBe(true);
      expect(w.validSpawn(SPAWNS[1]!)).toBe(true);
      expect(w.validSpawn({ x: -5, y: 0.1, z: 2 })).toBe(false);
    }));
  it("bounds diagonal speed and acceleration with gravity and floor contact", () =>
    withWorld((w) => {
      const s = createMotion({ x: 0, y: 0.04, z: 14 });
      for (let i = 0; i < 10; i++) w.step("p", s, neutralInput());
      expect(s.grounded).toBe(true);
      const input = { ...neutralInput(), x: 1, z: -1 };
      w.step("p", s, input);
      expect(Math.hypot(s.velocity.x, s.velocity.z)).toBeLessThanOrEqual(
        MOVEMENT.acceleration / 30 + 0.001,
      );
      for (let i = 0; i < 60; i++) w.step("p", s, input);
      expect(Math.hypot(s.velocity.x, s.velocity.z)).toBeLessThanOrEqual(
        MOVEMENT.walk + 0.001,
      );
      expect(s.position.y).toBeGreaterThanOrEqual(-0.02);
    }));
  it("allows grounded jumping and rejects air and crouched jumping", () =>
    withWorld((w) => {
      const s = createMotion({ x: 0, y: 0.04, z: 14 });
      for (let i = 0; i < 10; i++) w.step("p", s, neutralInput());
      w.step("p", s, { ...neutralInput(), jump: true });
      expect(s.velocity.y).toBeGreaterThan(6);
      const vy = s.velocity.y;
      w.step("p", s, { ...neutralInput(), jump: true });
      expect(s.velocity.y).toBeLessThan(vy);
      for (let i = 0; i < 60; i++) w.step("p", s, neutralInput());
      w.step("p", s, { ...neutralInput(), crouch: true, jump: true });
      expect(s.velocity.y).toBeLessThanOrEqual(0);
    }));
  it("handles crouch headroom and prevents standing through a beam", () =>
    withWorld((w) => {
      const s = createMotion({ x: 8, y: 0.04, z: 8 });
      s.crouched = true;
      for (let i = 0; i < 3; i++)
        w.step("p", s, { ...neutralInput(), crouch: true });
      w.step("p", s, neutralInput());
      expect(s.crouched).toBe(true);
    }));
  it("climbs a ramp within the permitted slope", () =>
    withWorld((w) => {
      const s = createMotion({ x: -11, y: 0.04, z: 6 });
      for (let i = 0; i < 65; i++) w.step("p", s, { ...neutralInput(), z: -1 });
      expect(s.position.y).toBeGreaterThan(1);
      expect(s.grounded).toBe(true);
    }));
  it("blocks walls and enforces fallback world bounds", () =>
    withWorld((w) => {
      const s = createMotion({ x: 14, y: 0.04, z: 14 });
      for (let i = 0; i < 100; i++) w.step("p", s, { ...neutralInput(), x: 1 });
      expect(s.position.x).toBeLessThan(15.5);
      s.position.x = 1000;
      expect(enforceBounds(s)).toBe(true);
      expect(Math.abs(s.position.x)).toBeLessThan(16);
    }));
  it("uses geometry occlusion before target damage and caps range", () =>
    withWorld((w) => {
      expect(
        w.raycast({ x: -7, y: 1.65, z: 14 }, { x: 0, y: 0, z: -1 }, () => true)
          .targetId,
      ).toBe("plate-a");
      expect(
        w.raycast({ x: 0, y: 1.65, z: 14 }, { x: 0, y: 0, z: -1 }, () => true)
          .targetId,
      ).toBeNull();
      expect(
        w.raycast({ x: -7, y: 1.65, z: 100 }, { x: 0, y: 0, z: -1 }, () => true)
          .targetId,
      ).toBeNull();
    }));
});
describe("prediction, acknowledgement and remote interpolation", () => {
  it("bounds pending input history and removes only acknowledged inputs", () => {
    const p = new PredictionBuffer();
    for (let i = 1; i <= LIMITS.inputHistory; i++)
      expect(p.push(neutralInput(i, i))).toBe(true);
    expect(p.push(neutralInput(999, 999))).toBe(false);
    p.acknowledge(90);
    expect(p.pending).toHaveLength(90);
    expect(p.pending[0]!.seq).toBe(91);
    expect(p.acknowledge(89)).toBe(false);
  });
  it("replays pending input and hard-corrects serious desync", () => {
    const p = new PredictionBuffer(),
      local = createMotion({ x: 10, y: 0, z: 0 }),
      authority = player();
    authority.position = { x: 0, y: 0, z: 0 };
    authority.lastInput = 1;
    p.push(neutralInput(1, 1));
    p.push(neutralInput(2, 2));
    p.reconcile(local, authority, {
      step: (_id, state) => {
        state.position.x += 1;
      },
    });
    expect(local.position.x).toBe(1);
    expect(p.visualOffset.x).toBe(0);
    expect(p.maxCorrection).toBe(9);
    expect(p.corrections).toBe(1);
  });
  it("smooths small corrections with bounded decay", () => {
    const p = new PredictionBuffer(),
      local = createMotion({ x: 0.1, y: 0, z: 0 }),
      authority = player();
    authority.position = { x: 0, y: 0, z: 0 };
    p.reconcile(local, authority, { step: () => {} });
    expect(p.visualOffset.x).toBeCloseTo(0.1);
    p.smooth(0.1);
    expect(p.visualOffset.x).toBeLessThan(0.04);
  });
  it("interpolates behind time, limits extrapolation and wraps angles", () => {
    const b = new SnapshotBuffer();
    b.push(snapshot(1, 1000, 0));
    b.push(snapshot(2, 1100, 1));
    const out = createMotion({ x: 0, y: 0, z: 0 });
    b.sample("p0", 1150, out);
    expect(out.position.x).toBeCloseTo(0.5);
    expect(Math.abs(lerpAngle(3.1, -3.1, 0.5))).toBeCloseTo(Math.PI);
    b.items[1]!.players[0]!.velocity.x = 5;
    b.sample("p0", 5000, out);
    expect(out.position.x).toBe(1.5);
    for (let i = 3; i < 80; i++) b.push(snapshot(i, 1000 + i * 100, i));
    expect(b.items).toHaveLength(LIMITS.snapshots);
    b.reset();
    expect(b.items).toHaveLength(0);
  });
});
describe("one server-owned rifle", () => {
  it("consumes rounds exactly once and enforces cadence", () => {
    const w = newWeapon();
    fireWeapon(w, 1, 1000);
    expect(w.magazine).toBe(29);
    expect(() => fireWeapon(w, 1, 1200)).toThrow("SHOT_SEQUENCE");
    expect(() => fireWeapon(w, 2, 1001)).toThrow("FIRE_RATE");
    expect(w.magazine).toBe(29);
    fireWeapon(w, 3, 1150);
    expect(w.magazine).toBe(28);
  });
  it("rejects an empty magazine and player damage", () => {
    const w = newWeapon();
    w.magazine = 0;
    expect(() => fireWeapon(w, 1, 1000)).toThrow("EMPTY");
    expect(canDamage("player")).toBe(false);
    expect(canDamage("trainingTarget")).toBe(true);
  });
  it("rejects unnecessary reload, repeated reload is idempotent and firing cannot interrupt", () => {
    const w = newWeapon();
    expect(() => reloadWeapon(w, 1, 0)).toThrow("INVALID_RELOAD");
    fireWeapon(w, 1, 1000);
    expect(reloadWeapon(w, 2, 1200)).toBe(true);
    const end = w.reloadAt;
    expect(reloadWeapon(w, 2, 1400)).toBe(false);
    expect(reloadWeapon(w, 3, 1500)).toBe(false);
    expect(w.reloadAt).toBe(end);
    expect(() => fireWeapon(w, 2, 1600)).toThrow("RELOADING");
    expect(completeReload(w, end - 1)).toBe(false);
    expect(completeReload(w, end)).toBe(true);
    expect(w.magazine).toBe(RIFLE.magazine);
    expect(w.reserve).toBe(RIFLE.reserve - 1);
    expect(completeReload(w, end + 1)).toBe(false);
  });
});
