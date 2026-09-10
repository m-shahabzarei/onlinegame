// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";
import { SIMULATION } from "../../src/game/shared/config";
import {
  ArenaPhysics,
  createMotion,
  initPhysics,
} from "../../src/game/shared/physics";
import { PredictionBuffer, distance } from "../../src/game/shared/prediction";
import {
  neutralInput,
  type PlayerInput,
  type Reservation,
  type WorldSnapshot,
} from "../../src/game/shared/protocol";
import { tokenTimes } from "../../src/game/shared/tokens";
import { MatchInstance, type Peer } from "./match";
beforeAll(initPhysics);
describe("prediction under bounded transport delay", () => {
  for (const rtt of [50, 100, 150])
    it(`converges at ${rtt} ms RTT with jitter and a 250 ms TCP interruption`, () => {
      let now = 1000,
        enabled = false,
        wireAt = 0,
        snapshotAt = 0;
      const dt = 1000 / 30;
      const incoming: { at: number; input: PlayerInput }[] = [],
        outgoing: { at: number; snapshot: WorldSnapshot }[] = [];
      const reservation: Reservation = {
        matchId: "network",
        roomId: "room",
        runtimeId: "runtime",
        serverEpoch: "epoch",
        createdAt: now,
        players: [
          { userId: "a", playerId: "a", name: "A", kind: "USER", slot: 0 },
          { userId: "b", playerId: "b", name: "B", kind: "GUEST", slot: 1 },
        ],
      };
      const physics = new ArenaPhysics(1 / 30),
        local = createMotion({ x: -3, y: 0.04, z: 14 }),
        prediction = new PredictionBuffer();
      const match = new MatchInstance(
        reservation,
        () => now,
        () => {},
        { ...SIMULATION, countdownMs: 100 },
      );
      const peer: Peer = {
        send: (message) => {
          if (enabled && message.type === "worldSnapshot") {
            snapshotAt = Math.max(
              snapshotAt,
              now + rtt / 2 + (message.snapshot.tick % 3) * 7,
            );
            outgoing.push({
              at: snapshotAt,
              snapshot: structuredClone(message.snapshot),
            });
          }
        },
        close: () => {},
      };
      const other: Peer = { send: () => {}, close: () => {} };
      let maxPending = 0,
        maxError = 0;
      try {
        for (const slot of [0, 1] as const) {
          match.join(
            {
              ...reservation.players[slot],
              ...tokenTimes(now),
              aud: "twoplayer-gameplay",
              matchId: "network",
              roomId: "room",
              runtimeId: "runtime",
            },
            slot === 0 ? peer : other,
          );
          match.command(
            reservation.players[slot].playerId,
            slot === 0 ? peer : other,
            {
              v: 3,
              type: "clientReady",
              mapId: "quarantine-yard",
              mapVersion: 2,
            },
          );
        }
        while (match.state !== "PLAYING") {
          now += dt;
          match.step();
        }
        enabled = true;
        const start = now;
        for (let seq = 1; seq <= 600; seq++) {
          now += dt;
          const input = {
            ...neutralInput(seq, match.tick + 1),
            x: seq < 500 ? (Math.floor(seq / 90) % 2 ? 1 : -1) : 0,
          };
          prediction.push(input);
          physics.step("a", local, input);
          const interruption =
            now - start >= 5000 && now - start < 5250 ? start + 5250 : 0;
          wireAt = Math.max(
            wireAt,
            now + rtt / 2 + (seq % 3) * 7,
            interruption,
          );
          incoming.push({ at: wireAt, input });
          while (incoming[0] && incoming[0].at <= now)
            match.command("a", peer, incoming.shift()!.input);
          match.step();
          while (outgoing[0] && outgoing[0].at <= now)
            prediction.reconcile(
              local,
              outgoing.shift()!.snapshot.players[0]!,
              physics,
            );
          maxPending = Math.max(maxPending, prediction.pending.length);
          maxError = Math.max(maxError, prediction.error);
        }
        expect(maxPending).toBeLessThan(30);
        expect(maxError).toBeLessThan(1.5);
        expect(
          distance(local.position, match.players[0]!.state.position),
        ).toBeLessThan(0.1);
        console.info(
          JSON.stringify({
            event: "network_condition_test",
            rttMs: rtt,
            jitterMs: 14,
            interruptionMs: 250,
            maxPending,
            maxCorrectionMetres: maxError,
            finalErrorMetres: distance(
              local.position,
              match.players[0]!.state.position,
            ),
          }),
        );
      } finally {
        physics.dispose();
        match.dispose();
      }
    }, 15000);
});
