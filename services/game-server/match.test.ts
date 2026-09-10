// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { SIMULATION } from "../../src/game/shared/config";
import { initPhysics } from "../../src/game/shared/physics";
import {
  neutralInput,
  type Reservation,
  type ServerMessage,
} from "../../src/game/shared/protocol";
import { tokenTimes, type JoinClaims } from "../../src/game/shared/tokens";
import { MatchInstance, type Peer } from "./match";
beforeAll(initPhysics);
export const reservation: Reservation = {
  matchId: "test-match",
  roomId: "room",
  runtimeId: "runtime",
  serverEpoch: "epoch",
  createdAt: 1000,
  players: [
    { userId: "a", playerId: "pa", name: "Alpha", kind: "USER", slot: 0 },
    { userId: "b", playerId: "pb", name: "Bravo", kind: "GUEST", slot: 1 },
  ],
};
function fixture() {
  let now = 1000;
  const events: ServerMessage[][] = [[], []];
  const peers: Peer[] = events.map((messages) => ({
    send: (m) => messages.push(structuredClone(m)),
    close: () => {},
  }));
  const states: string[] = [];
  const match = new MatchInstance(
    structuredClone(reservation),
    () => now,
    (state) => states.push(state),
    { ...SIMULATION, countdownMs: 100, startupMs: 2000, reconnectMs: 1000 },
  );
  const claims = (slot: 0 | 1): JoinClaims => ({
    ...reservation.players[slot],
    ...tokenTimes(now),
    aud: "twoplayer-gameplay",
    matchId: reservation.matchId,
    roomId: reservation.roomId,
    runtimeId: reservation.runtimeId,
  });
  const join = () => {
    match.join(claims(0), peers[0]!);
    match.join(claims(1), peers[1]!);
  };
  const ready = () => {
    for (const slot of [0, 1] as const)
      match.command(reservation.players[slot].playerId, peers[slot]!, {
        v: 2,
        type: "clientReady",
        mapId: "quarantine-yard",
        mapVersion: 2,
      });
  };
  const advance = (ms: number) => {
    for (let remaining = ms; remaining > 0; remaining -= 1000 / 30) {
      now += 1000 / 30;
      match.step();
    }
  };
  return { match, events, peers, states, claims, join, ready, advance };
}
describe("authoritative match instance", () => {
  it("requires both reservations and scene readiness before synchronized play", () => {
    const f = fixture();
    try {
      expect(() =>
        f.match.join({ ...f.claims(0), userId: "outsider" }, f.peers[0]!),
      ).toThrow("UNAUTHORIZED");
      f.join();
      expect(f.match.state).toBe("LOADING");
      expect(() =>
        f.match.command("pa", f.peers[0]!, neutralInput(1, 1)),
      ).toThrow("NOT_PLAYING");
      f.ready();
      expect(f.match.state).toBe("COUNTDOWN");
      f.advance(110);
      expect(f.match.state).toBe("PLAYING");
      expect(f.states).toEqual([
        "WAITING_FOR_PLAYERS",
        "LOADING",
        "COUNTDOWN",
        "PLAYING",
      ]);
    } finally {
      f.match.dispose();
    }
  });
  it("ignores duplicate inputs, corrects impossible ticks and bounds queued time", () => {
    const f = fixture();
    try {
      f.join();
      f.ready();
      f.advance(110);
      const input = { ...neutralInput(1, f.match.tick), x: 1 };
      f.match.command("pa", f.peers[0]!, input);
      f.match.command("pa", f.peers[0]!, input);
      f.advance(34);
      expect(f.match.players[0]!.state.lastInput).toBe(1);
      expect(() =>
        f.match.command("pa", f.peers[0]!, neutralInput(2, 99999)),
      ).toThrow("INPUT_WINDOW");
      expect(f.events[0]!.some((m) => m.type === "movementCorrection")).toBe(
        true,
      );
      let rejected = 0;
      for (let i = 3; i < 100; i++) {
        try {
          f.match.command("pa", f.peers[0]!, neutralInput(i, f.match.tick + i));
        } catch {
          rejected++;
        }
      }
      expect(rejected).toBeGreaterThan(80);
    } finally {
      f.match.dispose();
    }
  });
  it("restores position, health and ammunition during reconnect; rejects duplicate live slots", () => {
    const f = fixture();
    try {
      f.join();
      f.ready();
      f.advance(110);
      expect(() => f.match.join(f.claims(0), f.peers[0]!)).toThrow(
        "SLOT_CONNECTED",
      );
      f.match.command("pa", f.peers[0]!, {
        v: 2,
        type: "fire",
        seq: 1,
        tick: f.match.tick,
        yaw: 0,
        pitch: 0,
      });
      const before = structuredClone(f.match.players[0]!.state);
      f.match.disconnect("pa", f.peers[0]!);
      expect(f.match.state).toBe("RECONNECTING");
      f.advance(100);
      f.match.join(f.claims(0), f.peers[0]!);
      f.ready();
      expect(f.match.state).toBe("PLAYING");
      expect(f.match.players[0]!.state.weapon).toEqual(before.weapon);
      expect(f.match.players[0]!.state.health).toBe(100);
    } finally {
      f.match.dispose();
    }
  });
  it("times out startup, ends on leave and retains a living teammate after reconnect expiry", () => {
    for (const kind of ["startup", "leave", "disconnect"]) {
      const f = fixture();
      try {
        if (kind === "startup") f.advance(2100);
        else {
          f.join();
          f.ready();
          f.advance(110);
          if (kind === "leave")
            f.match.command("pa", f.peers[0]!, { v: 2, type: "leaveMatch" });
          else {
            f.match.disconnect("pa", f.peers[0]!);
            f.advance(1100);
          }
        }
        if (kind === "disconnect") {
          expect(f.match.state).toBe("RECONNECTING");
          expect(f.match.players[0]!.state.life).toBe("ELIMINATED");
          expect(f.match.players[1]!.state.life).toBe("ALIVE");
        } else expect(["CANCELLED", "ENDED"]).toContain(f.match.state);
      } finally {
        f.match.dispose();
      }
    }
  });
  it("does not duplicate shots, hits visible targets, blocks geometry and never damages players", () => {
    const f = fixture();
    try {
      f.join();
      f.ready();
      f.advance(110);
      const p = f.match.players[0]!.state;
      Object.assign(p.position, { x: -7, y: 0.015, z: 14 });
      const fire = (seq: number, yaw = 0) =>
        f.match.command("pa", f.peers[0]!, {
          v: 2,
          type: "fire",
          seq,
          tick: f.match.tick,
          yaw,
          pitch: 0,
        });
      fire(1);
      expect(f.match.targets[0]!.health).toBe(75);
      expect(p.weapon.magazine).toBe(29);
      fire(1);
      expect(p.weapon.magazine).toBe(29);
      f.advance(200);
      Object.assign(p.position, { x: 0, y: 0.015, z: 14 });
      fire(2);
      expect(f.match.targets[2]!.health).toBe(100);
      f.advance(200);
      Object.assign(p.position, { x: 3, y: 0.015, z: 16 });
      fire(3);
      expect(f.match.players[1]!.state.health).toBe(100);
      expect(
        f.events[0]!.some(
          (m) => m.type === "shotConfirmed" && m.targetId === null,
        ),
      ).toBe(true);
    } finally {
      f.match.dispose();
    }
  });
});
