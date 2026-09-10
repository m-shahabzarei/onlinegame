import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MAP_ID, MAP_VERSION, SIMULATION } from "../shared/config";
import { DEFAULT_SETTINGS } from "../shared/settings";
import { createMotion } from "../shared/physics";
import { newWeapon } from "../shared/weapon";
import type { ServerMessage, WorldSnapshot } from "../shared/protocol";
import { GameRuntime } from "./runtime";
import { newLife, emptyPvE } from "../shared/pve";
import { ZombiePresentationStore } from "./zombie-buffer";

const transport = vi.hoisted(() => ({
  receive: (() => {}) as (message: ServerMessage) => void,
  dispose: vi.fn(),
  send: vi.fn(),
  sound: vi.fn(),
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
    async prepare() {}
    updateTargets() {}
    dispose() {}
  },
}));
vi.mock("./audio", () => ({
  GameAudio: class {
    play = transport.sound;
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
    vi.fn(),
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
    v: 2,
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
    v: 2,
    type: "movementCorrection",
    tick: 31,
    player: snapshot.players[0]!,
    code: "INPUT_WINDOW",
  });
  transport.receive({ v: 2, type: "connectionWarning", code: "INPUT_WINDOW" });
  expect(runtime.input.collect(2, 32).x).toBe(1);
  window.dispatchEvent(new Event("blur"));
  expect(runtime.input.collect(3, 33).x).toBe(0);
});

it("closes network timers and transport immediately when the match ends", () => {
  transport.receive({ v: 2, type: "matchState", state: "ENDED", startAt: 0 });
  expect(transport.dispose).toHaveBeenCalledOnce();
});

it("rejects reload while downed and clears predicted movement on the life transition", () => {
  snapshot.players[0]!.life = "DOWNED";
  snapshot.players[0]!.health = 0;
  const downed = structuredClone(snapshot);
  downed.tick++;
  downed.players[0]!.position.x = 2;
  transport.receive({ v: 2, type: "worldSnapshot", snapshot: downed });
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
    v: 2,
    type: "beginRevive",
    targetId: "teammate",
    seq: 1,
  });
  document.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyE" }));
  expect(transport.send).toHaveBeenLastCalledWith({
    v: 2,
    type: "cancelRevive",
    seq: 2,
  });
  document.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyE" }));
  window.dispatchEvent(new Event("blur"));
  expect(runtime.input.interacting).toBe(false);
  expect(transport.send).toHaveBeenLastCalledWith({
    v: 2,
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
    v: 2,
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
    v: 2,
    type: "waveStateChanged",
    seq: 19,
    wave: { ...reconnect.pve.wave, state: "ACTIVE" },
  });
  expect(reconnect.pve.wave.state).toBe("CLEARING");
  expect(transport.sound).not.toHaveBeenCalled();
});
