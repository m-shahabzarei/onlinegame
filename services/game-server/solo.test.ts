// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { SIMULATION } from "../../src/game/shared/config";
import { initPhysics } from "../../src/game/shared/physics";
import { MatchInstance, type Peer } from "./match";
import type {
  Reservation,
  ServerMessage,
} from "../../src/game/shared/protocol";
import { tokenTimes, type JoinClaims } from "../../src/game/shared/tokens";

beforeAll(initPhysics);
describe("authoritative solo mode", () => {
  it("starts after one player is ready and never waits for slot two", () => {
    let now = 1000;
    const messages: ServerMessage[] = [];
    const peer: Peer = { send: (m) => messages.push(m), close() {} };
    const reservation = {
      matchId: "solo-match",
      roomId: "room",
      runtimeId: "runtime",
      serverEpoch: "epoch",
      createdAt: now,
      mode: "solo",
      players: [
        { userId: "a", playerId: "pa", name: "Alpha", kind: "USER", slot: 0 },
      ],
    } as unknown as Reservation;
    const match = new MatchInstance(
      reservation,
      () => now,
      () => {},
      { ...SIMULATION, countdownMs: 1 },
    );
    try {
      const claims = {
        ...reservation.players[0],
        ...tokenTimes(now),
        aud: "twoplayer-gameplay",
        matchId: reservation.matchId,
        roomId: reservation.roomId,
        runtimeId: reservation.runtimeId,
      } as JoinClaims;
      match.join(claims, peer);
      expect(match.state).toBe("LOADING");
      match.command("pa", peer, {
        v: 2,
        type: "clientReady",
        mapId: "quarantine-yard",
        mapVersion: 2,
      });
      expect(match.state).toBe("COUNTDOWN");
      now += 20;
      match.step();
      expect(match.state).toBe("PLAYING");
      expect(messages.find((m) => m.type === "welcome")).toMatchObject({
        mode: "solo",
      });
    } finally {
      match.dispose();
    }
  });
});
