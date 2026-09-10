import { describe, expect, it } from "vitest";
import { CONTENT_PROFILES, FINAL_BOSS, emptyPhase6Player, resolveWeaponStats, spendScrap, addScrap } from "./phase6";
import { parseClientMessage, serverMessageSchema } from "./protocol";

describe("Phase 6 content and economy", () => {
  it("keeps explicit five-wave and ten-wave profiles", () => {
    expect(CONTENT_PROFILES["phase5-test"].regularWaves).toBe(5);
    expect(CONTENT_PROFILES["phase6-production"].regularWaves).toBe(10);
  });
  it("bounds wallet arithmetic and prevents overspending", () => {
    const player = emptyPhase6Player();
    addScrap(player, 10000);
    expect(player.scrap).toBe(9999);
    expect(spendScrap(player, 10000)).toBe(false);
    expect(player.scrap).toBe(9999);
  });
  it("resolves deterministic upgrade stats", () => {
    const base = resolveWeaponStats("ar-01", 0);
    const upgraded = resolveWeaponStats("ar-01", 3);
    expect(upgraded.baseDamage).toBeGreaterThan(base.baseDamage);
    expect(upgraded.magazineCapacity).toBeGreaterThan(base.magazineCapacity);
  });
  it("defines a two-phase final boss", () => {
    expect(FINAL_BOSS.phases.length).toBeGreaterThanOrEqual(2);
    expect(FINAL_BOSS.phases[1]!.threshold).toBeLessThan(1);
  });
  it("parses versioned purchase intents and authoritative state events", () => {
    expect(parseClientMessage(JSON.stringify({ v: 2, type: "purchaseWeapon", requestId: "r", weaponId: "pistol-01" }))).toMatchObject({ type: "purchaseWeapon" });
    expect(() => serverMessageSchema.parse({ v: 2, type: "phase6State", snapshot: { schemaVersion: 1, profile: "phase6-production", shopOpen: false, shopUntil: 0, players: {}, gates: {}, objectives: {}, miniBoss: null, boss: null, outcome: "ACTIVE", summary: null, revision: 0 } })).not.toThrow();
  });
});
