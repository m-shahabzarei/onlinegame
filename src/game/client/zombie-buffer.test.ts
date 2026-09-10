import { describe, expect, it } from "vitest";
import { ZombieAI, type PvEEvent, type ZombieSnapshot } from "../shared/pve";
import { ZombiePresentationStore } from "./zombie-buffer";
const zombie = (id = "z1", revision = 1, x = 0): ZombieSnapshot => ({
  id,
  revision,
  archetype: "walker",
  position: { x, y: 0, z: 0 },
  velocity: { x: 2, y: 0, z: 0 },
  yaw: 0,
  health: 65,
  maxHealth: 65,
  state: ZombieAI.Chasing,
  stateUntil: 0,
  spawnAt: 900,
  tick: 1,
});
const event = (seq: number): PvEEvent => ({
  seq,
  tick: 1,
  time: 1000,
  kind: "zombieDamaged",
  entityId: "z1",
  revision: 1,
  playerId: "",
  position: { x: 0, y: 0, z: 0 },
  point: { x: 0, y: 0, z: 0 },
  amount: 25,
  until: 0,
  detail: "body",
});
describe("pooled authoritative zombie presentation", () => {
  it("interpolates buffered transforms, bounds extrapolation and resets large corrections", () => {
    const store = new ZombiePresentationStore();
    store.accept([zombie()], 1, 1000);
    store.accept([zombie("z1", 1, 1)], 2, 1100);
    const slot = store.active.get("z1")!;
    slot.sample(1150);
    expect(slot.transform.x).toBeCloseTo(0.5);
    slot.sample(9999);
    expect(slot.transform.x).toBeCloseTo(1.2);
    store.accept([zombie("z1", 1, 10)], 3, 1200);
    slot.sample(1250);
    expect(slot.transform.x).toBe(10);
    expect(slot.corrections).toBe(1);
  });
  it("fully resets a reused slot, rejects stale generations and cleans missing entities", () => {
    const store = new ZombiePresentationStore();
    store.accept([zombie()], 1, 1000);
    const slot = store.active.get("z1")!;
    store.event(event(1));
    expect(slot.damageUntil).toBe(1180);
    store.accept([], 2, 1100);
    expect(store.active.size).toBe(0);
    expect(slot.id).toBe("");
    expect(slot.history).toHaveLength(0);
    expect(slot.damageUntil).toBe(0);
    store.accept([zombie("z2", 2, 5)], 3, 1200);
    expect(store.active.get("z2")).toBe(slot);
    store.event({ ...event(2), entityId: "z2", revision: 1 });
    expect(slot.damageUntil).toBe(0);
    expect(store.accept([zombie()], 1, 1000)).toBe(false);
    expect(store.active.has("z1")).toBe(false);
    store.reset(100);
    expect(store.pooled).toBe(48);
    expect(store.event(event(3))).toBe(false);
  });
  it.each([50, 100, 150])(
    "converges with %i ms latency, jitter, delayed/out-of-order snapshots and duplication",
    (latency) => {
      const store = new ZombiePresentationStore();
      const transport: {
        at: number;
        tick: number;
        time: number;
        zombies: ZombieSnapshot[];
      }[] = [];
      for (let tick = 1; tick <= 120; tick++)
        transport.push({
          at:
            tick * 66 + latency + (tick % 4) * 9 + (tick % 11 === 0 ? 250 : 0),
          tick,
          time: 1000 + tick * 66,
          zombies:
            tick < 90
              ? [zombie("z1", 1, tick * 0.01)]
              : tick < 100
                ? []
                : [zombie("z2", 2, tick * 0.01)],
        });
      transport.sort((a, b) => a.at - b.at);
      for (const packet of transport) {
        store.accept(packet.zombies, packet.tick, packet.time);
        store.accept(packet.zombies, packet.tick, packet.time);
        expect(store.active.size).toBeLessThanOrEqual(1);
        expect(store.slots.filter((s) => !!s.id).length).toBe(
          store.active.size,
        );
        for (const slot of store.active.values()) {
          slot.sample(packet.at + 1000);
          expect(slot.history.length).toBeLessThanOrEqual(16);
        }
      }
      expect([...store.active.keys()]).toEqual(["z2"]);
      expect(store.active.get("z2")!.latest!.position.x).toBe(1.2);
      expect(store.event(event(100))).toBe(true);
      expect(store.event(event(100))).toBe(false);
      expect(store.event(event(99))).toBe(false);
    },
  );
});
