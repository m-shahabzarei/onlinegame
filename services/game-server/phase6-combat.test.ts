// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { initPhysics } from "../../src/game/shared/physics";
import { resolveWeaponStats, WEAPONS } from "../../src/game/shared/phase6";
import {
  completeReload,
  fireWeapon,
  newWeapon,
  reloadWeapon,
  shotDirection,
} from "../../src/game/shared/weapon";
import { Phase6MatchState } from "./phase6";
import { accelerated, fixture } from "./pve/test-fixture";
import type { ClientMessage } from "../../src/game/shared/protocol";
import { PHASE6_WAVES, WaveDirector } from "./pve/waves";

beforeAll(initPhysics);
describe("shop inventory receipts and capacities", () => {
  const shop = () => {
    const s = new Phase6MatchState("phase6-production", ["pa", "pb"]);
    s.award("pa", 4000, 0);
    s.award("pb", 4000, 0);
    s.completeWave(5);
    s.openShop(1000, 30000);
    return s;
  };
  it("replaces the selected primary explicitly, retains ownership, and equips purchases", () => {
    const s = shop(),
      p = s.players.get("pa")!,
      before = p.scrap;
    expect(
      s.execute(
        "pa",
        { type: "purchaseWeapon", requestId: "one", weaponId: "smg-01" },
        1100,
      ).reason,
    ).toBe("slot_conflict");
    expect(p.scrap).toBe(before);
    expect(
      s.execute(
        "pa",
        {
          type: "purchaseWeapon",
          requestId: "two",
          weaponId: "smg-01",
          replaceWeaponId: "ar-01",
        },
        1100,
      ).ok,
    ).toBe(true);
    expect(p.slots).toEqual({ primary: "smg-01", secondary: null });
    expect(p.equippedWeapon).toBe("smg-01");
    expect(
      s.execute(
        "pa",
        { type: "purchaseWeapon", requestId: "three", weaponId: "pistol-01" },
        1500,
      ).ok,
    ).toBe(true);
    expect(p.ownedWeapons).toEqual(["ar-01", "smg-01", "pistol-01"]);
    expect(p.slots).toEqual({ primary: "smg-01", secondary: "pistol-01" });
    expect(
      s.execute(
        "pa",
        {
          type: "equipWeapon",
          requestId: "four",
          weaponId: "ar-01",
          slot: "primary",
          seq: 1,
        },
        1900,
      ).ok,
    ).toBe(true);
    expect(p.equippedWeapon).toBe("ar-01");
  });
  it("deduplicates per player and refuses unavailable items and full reserves without charging", () => {
    const s = shop(),
      p = s.players.get("pa")!;
    const purchase = {
      type: "purchaseWeapon" as const,
      requestId: "same",
      weaponId: "pistol-01",
    };
    const before = p.scrap;
    expect(s.execute("pa", purchase, 1100).ok).toBe(true);
    expect(s.execute("pa", purchase, 1100).reason).toBe("duplicate_request");
    expect(s.execute("pb", purchase, 1100).ok).toBe(true);
    expect(p.scrap).toBe(before - 120);
    const balance = p.scrap;
    for (const type of [
      "purchaseArmor",
      "purchaseMedkit",
      "purchaseGrenade",
      "purchaseDeployable",
    ] as const)
      expect(s.execute("pa", { type, requestId: type }, 1200).reason).toBe(
        "unavailable",
      );
    expect(
      s.execute("pa", { type: "purchaseAmmo", requestId: "full" }, 1200).reason,
    ).toBe("inventory_full");
    expect(p.scrap).toBe(balance);
    p.ammo["pistol-01"]!.reserve = 0;
    expect(
      s.execute("pa", { type: "purchaseAmmo", requestId: "refill" }, 1200).ok,
    ).toBe(true);
    expect(p.ammo["pistol-01"]!.reserve).toBe(72);
    expect(p.ammo["ar-01"]!.reserve).toBe(120);
  });
  it("rejects wrong slots, unowned weapons, reload switching and expired purchases", () => {
    const s = shop(),
      p = s.players.get("pa")!;
    expect(
      s.execute(
        "pa",
        {
          type: "equipWeapon",
          requestId: "a",
          weaponId: "ar-01",
          slot: "secondary",
          seq: 1,
        },
        1200,
      ).reason,
    ).toBe("invalid_weapon");
    expect(
      s.execute(
        "pa",
        {
          type: "equipWeapon",
          requestId: "b",
          weaponId: "heavy-01",
          slot: "primary",
          seq: 1,
        },
        1200,
      ).reason,
    ).toBe("invalid_weapon");
    p.ammo["ar-01"]!.reloadAt = 5000;
    expect(
      s.execute(
        "pa",
        {
          type: "equipWeapon",
          requestId: "c",
          weaponId: "ar-01",
          slot: "primary",
          seq: 1,
        },
        1200,
      ).reason,
    ).toBe("invalid_state");
    const balance = p.scrap;
    expect(
      s.execute(
        "pa",
        { type: "purchaseWeapon", requestId: "late", weaponId: "pistol-01" },
        31000,
      ).reason,
    ).toBe("shop_closed");
    expect(p.scrap).toBe(balance);
    expect(s.closeShop(31000)).toBe(true);
    expect(s.snapshot()).toMatchObject({ shopOpen: false, shopUntil: 0 });
  });
  it("rewards each death, damage event and cleared wave once", () => {
    const s = new Phase6MatchState("phase6-production", ["pa"]);
    s.recordDamage("pa", 75, false, false, "shot1");
    s.recordDamage("pa", 75, false, false, "shot1");
    s.recordKill("pa", "z1:spawn");
    s.recordKill("pa", "z1:spawn");
    s.completeWave(1);
    s.completeWave(1);
    expect(s.players.get("pa")).toMatchObject({ scrap: 75, score: 475 });
    expect(s.stats.get("pa")).toMatchObject({ kills: 1, damage: 75, waves: 1 });
  });
});

describe("resolved live weapon mechanics", () => {
  it("keeps a final authoritative intermission before the boss transition", () => {
    const configs = accelerated.waves.map((w) => ({
      ...w,
      budget: 1,
      guaranteed: [],
      weights: [{ archetype: "walker" as const, weight: 1 }],
      initialDelayMs: 0,
      intermissionMs: 30000,
    }));
    const director = new WaveDirector(
      () => 0,
      () => {},
      configs,
      true,
    );
    let now = 1000;
    director.countdown(now);
    for (let wave = 1; wave <= 5; wave++) {
      director.update(now, 0);
      expect(director.state.number).toBe(wave);
      director.spawned();
      director.defeated();
      director.update(now + 1, 0);
      expect(director.state.state).toBe("INTERMISSION");
      expect(director.state.until).toBe(now + 30001);
      now = director.state.until;
    }
    director.update(now, 0);
    expect(director.state.state).toBe("PHASE_COMPLETE");
  });
  it("production boss is a damageable authoritative entity and its death ends the match", () => {
    const configs = PHASE6_WAVES.map((w) => ({
      ...w,
      budget: 1,
      guaranteed: [],
      weights: [{ archetype: "walker" as const, weight: 1 }],
      initialDelayMs: 0,
      intermissionMs: 100,
    }));
    const f = fixture({ waves: configs });
    try {
      f.start();
      for (const p of f.match.players) p.state.protectedUntil = 999999;
      for (let i = 0; i < 2000 && f.match.state !== "BOSS_ACTIVE"; i++) {
        f.clear();
        f.advance(34);
      }
      expect(f.match.state).toBe("BOSS_ACTIVE");
      const boss = f.match.pve.entities.get(f.match.pve.bossEntityId!)!;
      expect(boss.health).toBe(9000);
      const p = f.match.players[0]!.state;
      Object.assign(p.position, { x: -7, y: 0.015, z: 14 });
      Object.assign(boss.position, { x: -7, y: 0, z: 10 });
      boss.health = 25;
      f.match.phase6.boss!.health = 25;
      boss.historyCount = 0;
      boss.historyCursor = 0;
      f.match.pve.entities.record(boss, f.match.tick);
      f.match.command("pa", f.peers[0]!, {
        v: 3,
        type: "fire",
        seq: 1,
        triggerSeq: 1,
        tick: f.match.tick,
        yaw: 0,
        pitch: 0,
      });
      expect(boss.health).toBe(0);
      expect(f.match.phase6.outcome).toBe("VICTORY");
      expect(f.match.state).toBe("ENDED");
      expect(f.match.outcome).toMatchObject({
        completedWaves: 10,
        reason: "boss_defeated",
      });
    } finally {
      f.match.dispose();
    }
  });
  it.each(WEAPONS.map((w) => [w.id] as const))(
    "%s uses its own ammo, cooldown, reload and spread",
    (id) => {
      const stats = resolveWeaponStats(id, 0),
        w = newWeapon(stats);
      fireWeapon(w, 1, 1000, stats);
      expect(w).toMatchObject({
        magazine: stats.magazineCapacity - 1,
        nextFireAt: 1000 + stats.fireIntervalMs,
      });
      expect(() => fireWeapon(w, 2, 1001, stats)).toThrow("FIRE_RATE");
      reloadWeapon(w, 1, 2000, stats);
      expect(w.reloadAt).toBe(2000 + stats.reloadMs);
      expect(completeReload(w, w.reloadAt - 1, stats)).toBe(false);
      expect(completeReload(w, w.reloadAt, stats)).toBe(true);
      expect(w.magazine).toBe(stats.magazineCapacity);
      const ray = shotDirection(0, 0, true, () => 1, stats);
      expect(ray.y).toBeCloseTo(
        Math.sin(stats.spread + stats.movementAccuracy),
      );
    },
  );
  it("upgrades alter the live mechanics rather than only snapshot metadata", () => {
    const base = resolveWeaponStats("ar-01", 0),
      upgraded = resolveWeaponStats("ar-01", 3),
      w = newWeapon(upgraded);
    expect(upgraded.baseDamage).toBeGreaterThan(base.baseDamage);
    expect(upgraded.magazineCapacity).toBeGreaterThan(base.magazineCapacity);
    expect(upgraded.reloadMs).toBeLessThan(base.reloadMs);
    expect(upgraded.fireIntervalMs).toBeLessThan(base.fireIntervalMs);
    expect(upgraded.spread).toBeLessThan(base.spread);
    fireWeapon(w, 1, 1000, upgraded);
    expect(w.nextFireAt).toBe(1000 + upgraded.fireIntervalMs);
  });
  it.each(WEAPONS)(
    "routes purchased $id upgrades through real match shots and reloads",
    (definition) => {
      const f = fixture(accelerated);
      try {
        f.start();
        for (const player of f.match.players)
          player.state.protectedUntil = 999999;
        const sim = f.match.pve,
          inventory = f.match.phase6.players.get("pa")!;
        // Authority-only fixture setup; all transactions and combat use normal commands.
        sim.waves.state.state = "INTERMISSION";
        sim.waves.state.until = f.now() + 30000;
        f.match.phase6.openShop(f.now(), 30000);
        f.match.phase6.clearedWaves = 5;
        f.match.phase6.award("pa", 4000, 0);
        const send = (command: Exclude<ClientMessage, { type: "join" }>) =>
          f.match.command("pa", f.peers[0]!, command);
        if (definition.id !== "ar-01")
          send({
            v: 3,
            type: "purchaseWeapon",
            requestId: "buy",
            weaponId: definition.id,
            ...(definition.slot === "primary"
              ? { replaceWeaponId: "ar-01" }
              : {}),
          });
        for (const level of [1, 2, 3])
          send({
            v: 3,
            type: "purchaseUpgrade",
            requestId: `upgrade-${level}`,
            upgradeId: `${definition.id}-upgrade-${level}`,
          });
        expect(inventory.equippedWeapon).toBe(definition.id);
        expect(inventory.upgrades[definition.id]).toBe(3);
        f.advance(sim.waves.state.until - f.now() + 34);
        const zombie = sim.entities.spawn(
          "brute",
          { x: -3, y: 0.04, z: 12 },
          sim.waves.config,
          f.now(),
          f.match.tick,
        );
        zombie.health = 2000;
        const apply = vi.spyOn(sim.damage, "apply"),
          ray = vi.spyOn(f.match.physics, "raycast");
        const stats = resolveWeaponStats(definition.id, 3),
          firedAt = f.now();
        send({
          v: 3,
          type: "fire",
          seq: 1,
          triggerSeq: 1,
          tick: f.match.tick,
          yaw: 0,
          pitch: 0,
        });
        expect(ray.mock.calls[0]?.[3]).toBe(stats.range);
        expect(apply).toHaveBeenCalledWith(
          zombie,
          expect.any(String),
          firedAt,
          f.match.tick,
          stats,
          "pa",
        );
        const head = apply.mock.calls[0]?.[1] === "head";
        expect(zombie.health).toBe(
          2000 -
            Math.ceil(
              stats.baseDamage *
                (head ? stats.headshotMultiplier : sim.rules.bodyMultiplier),
            ),
        );
        expect(inventory.ammo[definition.id]!.nextFireAt).toBe(
          firedAt + stats.fireIntervalMs,
        );
        expect(inventory.ammo[definition.id]!.magazine).toBe(
          definition.magazineCapacity - 1,
        );
        send({ v: 3, type: "reload", seq: 1 });
        expect(inventory.ammo[definition.id]!.reloadAt).toBe(
          f.now() + stats.reloadMs,
        );
        f.advance(stats.reloadMs + 34);
        expect(inventory.ammo[definition.id]!.magazine).toBe(
          stats.magazineCapacity,
        );
        apply.mockRestore();
        ray.mockRestore();
      } finally {
        f.match.dispose();
      }
    },
  );
  it("ray selection and zombie damage use active range, resolved damage and headshot multiplier", () => {
    const f = fixture(accelerated);
    try {
      f.start();
      const sim = f.match.pve;
      const zombie = sim.entities.spawn(
        "walker",
        { x: 0, y: 0, z: -70 },
        sim.waves.config,
        f.now(),
        f.match.tick,
      );
      const origin = { x: 0, y: 1.55, z: 0 },
        direction = { x: 0, y: 0, z: -1 };
      expect(
        sim.damage.hit(origin, direction, 150, f.match.tick, 45),
      ).toBeNull();
      expect(
        sim.damage.hit(origin, direction, 150, f.match.tick, 100)?.zombie,
      ).toBe(zombie);
      for (const weapon of WEAPONS) {
        const stats = resolveWeaponStats(weapon.id, 2);
        zombie.health = 2000;
        expect(
          sim.damage.apply(zombie, "head", f.now(), f.match.tick, stats, "pa"),
        ).toBe(true);
        expect(zombie.health).toBe(
          2000 - Math.ceil(stats.baseDamage * stats.headshotMultiplier),
        );
      }
    } finally {
      f.match.dispose();
    }
  });
  it("opens a real wave shop, validates equip and press edges, restores loadout on reconnect, and expires the shop", () => {
    const f = fixture({
      ...accelerated,
      waves: accelerated.waves.map((w) => ({ ...w, intermissionMs: 30000 })),
    });
    try {
      f.start();
      for (const p of f.match.players) p.state.protectedUntil = 999999;
      for (let i = 0; i < 400 && !f.match.phase6.shopOpen; i++) {
        f.clear();
        f.advance(34);
      }
      const inventory = f.match.phase6.players.get("pa")!;
      expect(f.match.pve.waves.state.state).toBe("INTERMISSION");
      expect(f.match.phase6.shopUntil).toBe(f.match.pve.waves.state.until);
      f.match.phase6.award("pa", 500, 0);
      const send = (m: Exclude<ClientMessage, { type: "join" }>) =>
        f.match.command("pa", f.peers[0]!, m);
      send({
        v: 3,
        type: "purchaseWeapon",
        requestId: "pistol",
        weaponId: "pistol-01",
      });
      expect(inventory.equippedWeapon).toBe("pistol-01");
      expect(f.match.players[0]!.state.weapon).toBe(
        inventory.ammo["pistol-01"],
      );
      f.advance(300);
      const fire = (seq: number, triggerSeq: number) =>
        send({
          v: 3,
          type: "fire",
          seq,
          triggerSeq,
          tick: f.match.tick,
          yaw: 0,
          pitch: 0,
        });
      fire(1, 1);
      f.advance(300);
      fire(2, 1);
      expect(inventory.ammo["pistol-01"]!.magazine).toBe(11);
      send({ v: 3, type: "triggerRelease", seq: 1 });
      fire(3, 2);
      expect(inventory.ammo["pistol-01"]!.magazine).toBe(10);
      send({ v: 3, type: "reload", seq: 1 });
      send({
        v: 3,
        type: "equipWeapon",
        requestId: "reload-switch",
        weaponId: "ar-01",
        slot: "primary",
        seq: 1,
      });
      expect(inventory.equippedWeapon).toBe("pistol-01");
      const before = structuredClone(inventory);
      f.match.disconnect("pa", f.peers[0]!);
      f.match.join(f.claims(0), f.peers[0]!);
      f.ready(0);
      expect(f.match.snapshot().phase6!.players.pa).toEqual({
        ...before,
        triggerReleased: true,
      });
      f.advance(1300);
      send({
        v: 3,
        type: "equipWeapon",
        requestId: "primary",
        weaponId: "ar-01",
        slot: "primary",
        seq: 2,
      });
      expect(inventory.equippedWeapon).toBe("ar-01");
      const until = f.match.phase6.shopUntil;
      f.advance(until - f.now() + 34);
      expect(f.match.phase6.shopOpen).toBe(false);
      send({ v: 3, type: "purchaseAmmo", requestId: "stale" });
      expect(f.events[0]!.at(-1)).toMatchObject({
        type: "shopResult",
        code: "shop_closed",
      });
    } finally {
      f.match.dispose();
    }
  });
});
