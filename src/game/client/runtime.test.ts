import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MAP_ID, MAP_VERSION, SIMULATION } from "../shared/config";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { createMotion } from "../shared/physics";
import { newWeapon } from "../shared/weapon";
import type { ServerMessage, WorldSnapshot } from "../shared/protocol";
import { GameRuntime } from "./runtime";
import { newLife, emptyPvE } from "../shared/pve";
import { ZombiePresentationStore } from "./zombie-buffer";
import { emptyPhase6Player, type Phase6Snapshot } from "../shared/phase6";

const transport = vi.hoisted(() => ({
  receive: (() => {}) as (message: ServerMessage) => void,
  dispose: vi.fn(),
  send: vi.fn(),
  sound: vi.fn(),
  equip: vi.fn(),
  hud: vi.fn(),
}));
vi.mock("./network", () => ({
  GameplayNetwork: class {
    state = "Connected";
    constructor(_id: string, receive: (message: ServerMessage) => void) {
      transport.receive = receive;
    }
    connect() {}
    send(message: unknown) {
      transport.send(message);
      return true;
    }
    serverNow() {
      return Date.now();
    }
    dispose() {
      transport.dispose();
    }
  },
}));
vi.mock("./rendering", () => ({
  ArenaRenderer: class {
    zombies = { store: new ZombiePresentationStore() };
    renderer = { info: { render: { calls: 0, triangles: 0 } } };
    equip = transport.equip;
    remoteWeapon() {}
    async prepare() {}
    updateTargets() {}
    dispose() {}
  },
}));
vi.mock("./audio", () => ({
  GameAudio: class {
    play = transport.sound;
    playWeapon = transport.sound;
    dispose() {}
  },
}));
vi.mock("../shared/physics", async (original) => ({
  ...(await original<typeof import("../shared/physics")>()),
  initPhysics: async () => {},
  ArenaPhysics: class {
    dispose() {}
  },
}));

let runtime: GameRuntime;
let snapshot: WorldSnapshot;
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "requestAnimationFrame",
    vi.fn(() => 1),
  );
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  runtime = await GameRuntime.create(
    document.createElement("canvas"),
    DEFAULT_SETTINGS,
    transport.hud,
    "match",
  );
  snapshot = {
    tick: 30,
    time: Date.now(),
    state: "PLAYING",
    startAt: Date.now() - 1,
    targets: [],
    pve: emptyPvE(),
    players: [
      {
        ...createMotion({ x: 0, y: 0, z: 0 }),
        id: "self",
        slot: 0,
        name: "Player",
        connected: true,
        ready: true,
        lastInput: 0,
        health: 100,
        ...newLife(),
        weapon: newWeapon(),
      },
    ],
  };
  transport.receive({
    v: 3,
    type: "welcome",
    playerId: "self",
    matchId: "match",
    slot: 0,
    mapId: MAP_ID,
    mapVersion: MAP_VERSION,
    config: SIMULATION,
    snapshot,
  });
  runtime.input.locked = true;
});
afterEach(() => {
  runtime?.dispose();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("preserves held movement during a timing correction but clears it on blur", () => {
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyD" }));
  expect(runtime.input.collect(1, 31).x).toBe(1);
  transport.receive({
    v: 3,
    type: "movementCorrection",
    tick: 31,
    player: snapshot.players[0]!,
    code: "INPUT_WINDOW",
  });
  transport.receive({ v: 3, type: "connectionWarning", code: "INPUT_WINDOW" });
  expect(runtime.input.collect(2, 32).x).toBe(1);
  window.dispatchEvent(new Event("blur"));
  expect(runtime.input.collect(3, 33).x).toBe(0);
});

it("closes network timers and transport immediately when the match ends", () => {
  transport.receive({ v: 3, type: "matchState", state: "ENDED", startAt: 0 });
  expect(transport.dispose).toHaveBeenCalledOnce();
});

it("rejects reload while downed and clears predicted movement on the life transition", () => {
  snapshot.players[0]!.life = "DOWNED";
  snapshot.players[0]!.health = 0;
  const downed = structuredClone(snapshot);
  downed.tick++;
  downed.players[0]!.position.x = 2;
  transport.receive({ v: 3, type: "worldSnapshot", snapshot: downed });
  expect(runtime.local.position.x).toBe(2);
  runtime.reload();
  expect(transport.send.mock.calls.some(([m]) => m.type === "reload")).toBe(
    false,
  );
});

it("sends ordered hold and release intents and cancels an interaction on blur", () => {
  const teammate = structuredClone(snapshot.players[0]!);
  Object.assign(teammate, {
    id: "teammate",
    slot: 1,
    life: "DOWNED",
    health: 0,
    bleedOutAt: Date.now() + 30000,
  });
  teammate.position.x = 1;
  snapshot.players.push(teammate);
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
  expect(transport.send).toHaveBeenLastCalledWith({
    v: 3,
    type: "beginRevive",
    targetId: "teammate",
    seq: 1,
  });
  document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" }));
  expect(transport.send).toHaveBeenLastCalledWith({
    v: 3,
    type: "cancelRevive",
    seq: 2,
  });
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
  window.dispatchEvent(new Event("blur"));
  expect(runtime.input.interacting).toBe(false);
  expect(transport.send).toHaveBeenLastCalledWith({
    v: 3,
    type: "cancelRevive",
    seq: 4,
  });
});

it("ignores delayed wave events behind an authoritative reconnect watermark", () => {
  const reconnect = structuredClone(snapshot);
  reconnect.tick = 60;
  reconnect.pve.eventSeq = 20;
  reconnect.pve.wave.state = "CLEARING";
  transport.receive({
    v: 3,
    type: "welcome",
    playerId: "self",
    matchId: "match",
    slot: 0,
    mapId: MAP_ID,
    mapVersion: MAP_VERSION,
    config: SIMULATION,
    snapshot: reconnect,
  });
  transport.receive({
    v: 3,
    type: "waveStateChanged",
    seq: 19,
    wave: { ...reconnect.pve.wave, state: "ACTIVE" },
  });
  expect(reconnect.pve.wave.state).toBe("CLEARING");
  expect(transport.sound).not.toHaveBeenCalled();
});

function intermission(): Phase6Snapshot {
  snapshot.pve.wave = {
    ...snapshot.pve.wave,
    state: "INTERMISSION",
    number: 1,
    until: Date.now() + 30000,
    revision: 2,
  };
  return {
    schemaVersion: 1,
    profile: "phase6-production",
    shopOpen: true,
    shopUntil: snapshot.pve.wave.until,
    players: { self: emptyPhase6Player() },
    gates: {},
    objectives: {},
    miniBoss: null,
    boss: null,
    outcome: "ACTIVE",
    summary: null,
    revision: 1,
  };
}
it("opens from authority, releases the mouse, suspends all intent, and permits B reopening", () => {
  const phase6 = intermission();
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));
  document.dispatchEvent(new MouseEvent("mousedown", { button: 0 }));
  transport.receive({ v: 3, type: "phase6State", snapshot: phase6 });
  expect(runtime.input.active()).toBe(false);
  expect(runtime.input.firing).toBe(false);
  expect(runtime.input.collect(1, 31).z).toBe(0);
  expect(transport.send).toHaveBeenCalledWith({
    v: 3,
    type: "triggerRelease",
    seq: 1,
  });
  runtime.reload();
  expect(
    transport.send.mock.calls.some(([message]) => message.type === "reload"),
  ).toBe(false);
  vi.advanceTimersByTime(100);
  expect(transport.hud).toHaveBeenLastCalledWith(
    expect.objectContaining({
      shopVisible: true,
      shopOpen: true,
      shopSeconds: 30,
      locked: false,
    }),
  );
  runtime.closeShop();
  vi.advanceTimersByTime(100);
  expect(transport.hud).toHaveBeenLastCalledWith(
    expect.objectContaining({ shopVisible: false, shopOpen: true }),
  );
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB" }));
  vi.advanceTimersByTime(100);
  expect(transport.hud).toHaveBeenLastCalledWith(
    expect.objectContaining({ shopVisible: true }),
  );
});
it("closes at the authoritative deadline, rejects stale local purchases and B", () => {
  const phase6 = intermission();
  phase6.shopUntil = Date.now() + 200;
  transport.receive({ v: 3, type: "phase6State", snapshot: phase6 });
  vi.advanceTimersByTime(200);
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyB" }));
  runtime.purchasePhase6("weapon", "pistol-01");
  vi.advanceTimersByTime(100);
  expect(transport.hud).toHaveBeenLastCalledWith(
    expect.objectContaining({ shopVisible: false, shopOpen: false }),
  );
  expect(
    transport.send.mock.calls.some(
      ([message]) => message.type === "purchaseWeapon",
    ),
  ).toBe(false);
});
it("uses slot bindings and authoritative weapon ammunition, upgrade and sequence watermarks", () => {
  const phase6 = intermission();
  const player = phase6.players.self!;
  player.ownedWeapons.push("pistol-01");
  player.slots.secondary = "pistol-01";
  player.ammo["pistol-01"] = {
    ...newWeapon(),
    magazine: 7,
    reserve: 23,
    nextFireAt: Date.now() + 500,
  };
  player.upgrades["pistol-01"] = 2;
  player.lastEquip = 7;
  transport.receive({ v: 3, type: "phase6State", snapshot: phase6 });
  runtime.closeShop();
  runtime.input.locked = true;
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit2" }));
  const command = transport.send.mock.calls.at(-1)![0];
  expect(command).toEqual(
    expect.objectContaining({
      type: "equipWeapon",
      slot: "secondary",
      weaponId: "pistol-01",
      seq: 8,
    }),
  );
  player.equippedWeapon = "pistol-01";
  player.lastEquip = 8;
  phase6.revision++;
  transport.receive({
    v: 3,
    type: "shopResult",
    requestId: command.requestId,
    code: "accepted",
    snapshot: phase6,
  });
  vi.advanceTimersByTime(100);
  expect(transport.hud).toHaveBeenLastCalledWith(
    expect.objectContaining({
      magazine: 7,
      reserve: 23,
      equippedWeapon: "pistol-01",
      shopPending: false,
    }),
  );
  expect(transport.equip).toHaveBeenCalledWith(
    expect.objectContaining({ id: "pistol-01", magazineCapacity: 16 }),
  );
  expect(transport.equip.mock.calls.at(-1)![0].baseDamage).toBeCloseTo(43.52);
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "Digit1" }));
  expect(transport.send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      type: "equipWeapon",
      slot: "primary",
      weaponId: "ar-01",
      seq: 9,
    }),
  );
});
