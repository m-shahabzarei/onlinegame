import { SIMULATION } from "../../../src/game/shared/config";
import type {
  Reservation,
  ServerMessage,
} from "../../../src/game/shared/protocol";
import { tokenTimes, type JoinClaims } from "../../../src/game/shared/tokens";
import { MatchInstance, type Peer } from "../match";
import { PVE_RULES } from "./definitions";
import { WAVES } from "./waves";
import type { PvEOptions } from "./simulation";

export function fixture(options: PvEOptions = {}) {
  let now = 1000;
  const reservation: Reservation = {
    matchId: "pve-test",
    roomId: "room",
    runtimeId: "runtime",
    serverEpoch: "epoch",
    createdAt: now,
    players: [
      { userId: "a", playerId: "pa", name: "Alpha", kind: "USER", slot: 0 },
      { userId: "b", playerId: "pb", name: "Bravo", kind: "GUEST", slot: 1 },
    ],
  };
  const events: ServerMessage[][] = [[], []],
    transitions: string[] = [];
  const peers: Peer[] = events.map((messages) => ({
    send: (m) => messages.push(structuredClone(m)),
    close() {},
  }));
  const match = new MatchInstance(
    reservation,
    () => now,
    (state) => transitions.push(state),
    { ...SIMULATION, countdownMs: 100, reconnectMs: 1500 },
    { seed: 1234, ...options },
  );
  const claims = (slot: 0 | 1): JoinClaims => ({
    ...reservation.players[slot],
    ...tokenTimes(now),
    aud: "twoplayer-gameplay",
    matchId: reservation.matchId,
    roomId: "room",
    runtimeId: "runtime",
  });
  const ready = (slot: 0 | 1) =>
    match.command(reservation.players[slot].playerId, peers[slot]!, {
      v: 3,
      type: "clientReady",
      mapId: "quarantine-yard",
      mapVersion: 2,
    });
  const advance = (ms: number) => {
    for (let left = ms; left > 0; left -= 1000 / 30) {
      now += 1000 / 30;
      match.step();
    }
  };
  const start = () => {
    for (const slot of [0, 1] as const) {
      match.join(claims(slot), peers[slot]!);
      ready(slot);
    }
    advance(134);
  };
  const clear = () => {
    for (const z of match.pve.entities.entities)
      while (z.health > 0) match.pve.damage.apply(z, "head", now, match.tick);
  };
  return {
    match,
    peers,
    events,
    transitions,
    claims,
    ready,
    advance,
    start,
    clear,
    now: () => now,
  };
}
export const accelerated = {
  seed: 1234,
  rules: { ...PVE_RULES, reviveMs: 500, bleedOutMs: 1000 },
  waves: WAVES.map((w) => ({
    ...w,
    budget: Math.max(
      3,
      w.guaranteed.reduce(
        (n, a) =>
          n + (a === "brute" ? 3 : a === "spitter" || a === "screamer" ? 2 : 1),
        0,
      ),
    ),
    initialDelayMs: 0,
    interval: [100, 100] as [number, number],
    intermissionMs: 500,
  })),
};
