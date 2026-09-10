import { describe, expect, it } from "vitest";
import { Phase6MatchState } from "./phase6";

describe("authoritative Phase 6 match state", () => {
  it("processes purchases atomically and idempotently", () => {
    const state = new Phase6MatchState("phase6-production", ["p1"]);
    state.award("p1", 500, 0);
    state.openShop(1000, 10000);
    const first = state.execute("p1", { type: "purchaseWeapon", requestId: "r1", weaponId: "pistol-01" }, 1200);
    const duplicate = state.execute("p1", { type: "purchaseWeapon", requestId: "r1", weaponId: "pistol-01" }, 1200);
    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(false);
    expect(state.players.get("p1")!.ownedWeapons).toEqual(["ar-01", "pistol-01"]);
  });
  it("requires a cleared wave before the gate unlocks", () => {
    const state = new Phase6MatchState("phase6-production", ["p1"]);
    state.award("p1", 500, 0);
    state.openShop(1000, 10000);
    const blocked = state.execute("p1", { type: "unlockGate", requestId: "g1", gateId: "gate-east" }, 1200);
    expect(blocked.ok).toBe(false);
    state.completeWave(3);
    const opened = state.execute("p1", { type: "unlockGate", requestId: "g2", gateId: "gate-east" }, 1200);
    expect(opened.ok).toBe(true);
    expect(state.gates.get("gate-east")!.unlocked).toBe(true);
  });
  it("transitions boss health to victory exactly once", () => {
    const state = new Phase6MatchState("phase6-production", ["p1"]);
    state.spawnBoss();
    state.activateBoss(1000);
    state.damageBoss("p1", 3000, true);
    expect(state.boss!.phase).toBe(2);
    state.damageBoss("p1", 10000);
    expect(state.outcome).toBe("VICTORY");
    expect(state.boss!.state).toBe("DEFEATED");
  });
});

