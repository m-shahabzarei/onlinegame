import { z } from "zod";

const id = z.string().min(1).max(64);
const nonNegative = z.number().finite().nonnegative();

export const phase6ProfileSchema = z.enum(["phase5-test", "phase6-production"]);
export type Phase6Profile = z.infer<typeof phase6ProfileSchema>;

export const weaponSlotSchema = z.enum(["primary", "secondary"]);
export const ammoTypeSchema = z.enum([
  "rifle",
  "pistol",
  "shell",
  "smg",
  "heavy",
]);
export const fireModeSchema = z.enum(["semi", "automatic", "pump"]);
export const weaponDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    slot: weaponSlotSchema,
    ammoType: ammoTypeSchema,
    magazineCapacity: z.number().int().min(1).max(120),
    reserveCapacity: z.number().int().min(0).max(600),
    fireMode: fireModeSchema,
    fireIntervalMs: z.number().int().positive().max(2000),
    reloadMs: z.number().int().positive().max(10000),
    range: z.number().positive().max(200),
    baseDamage: z.number().positive().max(250),
    headshotMultiplier: z.number().min(1).max(4),
    spread: z.number().nonnegative().max(0.5),
    recoil: z.number().nonnegative().max(1),
    movementAccuracy: z.number().min(0).max(2),
    shopCost: z.number().int().nonnegative().max(10000),
    unlockWave: z.number().int().min(1).max(10),
    muzzleEffect: z.string().max(80),
    impactEffect: z.string().max(80),
    fireAudio: z.string().max(80),
    reloadAudio: z.string().max(80),
  })
  .strict();
export type WeaponDefinition = z.infer<typeof weaponDefinitionSchema>;

export const WEAPONS = Object.freeze([
  {
    schemaVersion: 1,
    id: "ar-01",
    slot: "primary",
    ammoType: "rifle",
    magazineCapacity: 30,
    reserveCapacity: 120,
    fireMode: "automatic",
    fireIntervalMs: 150,
    reloadMs: 1800,
    range: 65,
    baseDamage: 25,
    headshotMultiplier: 2,
    spread: 0.001,
    recoil: 0.12,
    movementAccuracy: 0.004,
    shopCost: 0,
    unlockWave: 1,
    muzzleEffect: "muzzle-rifle",
    impactEffect: "metal-spark",
    fireAudio: "synth-rifle",
    reloadAudio: "synth-reload",
  },
  {
    schemaVersion: 1,
    id: "pistol-01",
    slot: "secondary",
    ammoType: "pistol",
    magazineCapacity: 12,
    reserveCapacity: 72,
    fireMode: "semi",
    fireIntervalMs: 260,
    reloadMs: 1200,
    range: 45,
    baseDamage: 32,
    headshotMultiplier: 2.2,
    spread: 0.008,
    recoil: 0.16,
    movementAccuracy: 0.01,
    shopCost: 120,
    unlockWave: 1,
    muzzleEffect: "muzzle-pistol",
    impactEffect: "spark",
    fireAudio: "pistol-fire",
    reloadAudio: "pistol-reload",
  },
  {
    schemaVersion: 1,
    id: "smg-01",
    slot: "primary",
    ammoType: "smg",
    magazineCapacity: 36,
    reserveCapacity: 180,
    fireMode: "automatic",
    fireIntervalMs: 95,
    reloadMs: 1600,
    range: 42,
    baseDamage: 17,
    headshotMultiplier: 1.8,
    spread: 0.012,
    recoil: 0.2,
    movementAccuracy: 0.012,
    shopCost: 220,
    unlockWave: 2,
    muzzleEffect: "muzzle-smg",
    impactEffect: "spark",
    fireAudio: "smg-fire",
    reloadAudio: "smg-reload",
  },
  {
    schemaVersion: 1,
    id: "shotgun-01",
    slot: "primary",
    ammoType: "shell",
    magazineCapacity: 8,
    reserveCapacity: 48,
    fireMode: "pump",
    fireIntervalMs: 850,
    reloadMs: 2200,
    range: 22,
    baseDamage: 80,
    headshotMultiplier: 1.5,
    spread: 0.08,
    recoil: 0.35,
    movementAccuracy: 0.03,
    shopCost: 300,
    unlockWave: 3,
    muzzleEffect: "muzzle-shotgun",
    impactEffect: "impact-heavy",
    fireAudio: "shotgun-fire",
    reloadAudio: "shotgun-reload",
  },
  {
    schemaVersion: 1,
    id: "heavy-01",
    slot: "primary",
    ammoType: "heavy",
    magazineCapacity: 10,
    reserveCapacity: 50,
    fireMode: "semi",
    fireIntervalMs: 700,
    reloadMs: 2400,
    range: 100,
    baseDamage: 115,
    headshotMultiplier: 2.5,
    spread: 0.002,
    recoil: 0.28,
    movementAccuracy: 0.015,
    shopCost: 500,
    unlockWave: 5,
    muzzleEffect: "muzzle-heavy",
    impactEffect: "impact-heavy",
    fireAudio: "heavy-fire",
    reloadAudio: "heavy-reload",
  },
] satisfies readonly WeaponDefinition[]);
export const weaponRegistry = new Map(
  WEAPONS.map((w) => [w.id, weaponDefinitionSchema.parse(w)]),
);

export const upgradeDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    weaponId: id,
    level: z.number().int().min(1).max(3),
    cost: z.number().int().positive().max(10000),
    prerequisiteLevel: z.number().int().min(0).max(2),
    modifiers: z
      .object({
        damage: z.number().min(0).max(3).default(0),
        magazine: z.number().int().min(0).max(30).default(0),
        reloadMultiplier: z.number().min(0.5).max(1).default(1),
        fireIntervalMultiplier: z.number().min(0.5).max(1).default(1),
        spreadMultiplier: z.number().min(0.4).max(1).default(1),
      })
      .strict(),
  })
  .strict();
export type UpgradeDefinition = z.infer<typeof upgradeDefinitionSchema>;
export const UPGRADES = Object.freeze(
  WEAPONS.flatMap((w) =>
    [1, 2, 3].map((level) => ({
      schemaVersion: 1,
      id: `${w.id}-upgrade-${level}`,
      weaponId: w.id,
      level,
      cost: 90 * level + (w.shopCost ? Math.floor(w.shopCost / 4) : 0),
      prerequisiteLevel: level - 1,
      modifiers: {
        damage: 0.12 * level,
        magazine: level === 2 ? 4 : level === 3 ? 8 : 0,
        reloadMultiplier: level === 3 ? 0.82 : level === 2 ? 0.9 : 1,
        fireIntervalMultiplier: level === 3 ? 0.9 : level === 2 ? 0.95 : 1,
        spreadMultiplier: level === 3 ? 0.78 : level === 2 ? 0.88 : 1,
      },
    })),
  ),
);
export const upgradeRegistry = new Map(
  UPGRADES.map((u) => [u.id, upgradeDefinitionSchema.parse(u)]),
);

export const shopItemSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    cost: z.number().int().positive().max(10000),
    kind: z.enum(["ammo", "armor", "medkit", "grenade", "sentry"]),
    maxQuantity: z.number().int().positive().max(20),
  })
  .strict();
export const SHOP_ITEMS = Object.freeze([
  {
    schemaVersion: 1,
    id: "ammo-refill",
    cost: 35,
    kind: "ammo",
    maxQuantity: 6,
  },
  {
    schemaVersion: 1,
    id: "armor",
    cost: 80,
    kind: "armor",
    maxQuantity: 100,
  },
  {
    schemaVersion: 1,
    id: "medkit",
    cost: 60,
    kind: "medkit",
    maxQuantity: 3,
  },
  {
    schemaVersion: 1,
    id: "grenade",
    cost: 45,
    kind: "grenade",
    maxQuantity: 4,
  },
  {
    schemaVersion: 1,
    id: "sentry",
    cost: 180,
    kind: "sentry",
    maxQuantity: 2,
  },
] satisfies readonly z.infer<typeof shopItemSchema>[]);

export const gateDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    sectionId: id,
    cost: z.number().int().positive().max(10000),
    minimumWave: z.number().int().min(1).max(10),
    interactionMs: z.number().int().min(250).max(10000),
    mapRef: id,
  })
  .strict();
export const GATES = Object.freeze([
  {
    schemaVersion: 1,
    id: "gate-east",
    sectionId: "east-yard",
    cost: 250,
    minimumWave: 3,
    interactionMs: 1500,
    mapRef: "quarantine-yard-east",
  },
] satisfies readonly z.infer<typeof gateDefinitionSchema>[]);

export const objectiveDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    type: z.enum(["generator-defense", "intel-recovery"]),
    availableWave: z.number().int().min(1).max(10),
    durationMs: z.number().int().min(1000).max(120000),
    rewardScrap: z.number().int().positive().max(1000),
    rewardScore: z.number().int().positive().max(10000),
    location: z
      .object({ x: z.number(), y: z.number(), z: z.number() })
      .strict(),
    interactionMs: z.number().int().min(250).max(10000),
  })
  .strict();
export const OBJECTIVES = Object.freeze([
  {
    schemaVersion: 1,
    id: "generator-alpha",
    type: "generator-defense",
    availableWave: 2,
    durationMs: 15000,
    rewardScrap: 120,
    rewardScore: 500,
    location: { x: 10, y: 0, z: -8 },
    interactionMs: 1000,
  },
  {
    schemaVersion: 1,
    id: "intel-alpha",
    type: "intel-recovery",
    availableWave: 4,
    durationMs: 10000,
    rewardScrap: 90,
    rewardScore: 400,
    location: { x: -12, y: 0, z: 7 },
    interactionMs: 1200,
  },
] satisfies readonly z.infer<typeof objectiveDefinitionSchema>[]);

export const bossPhaseSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    threshold: z.number().min(0).max(1),
    telegraphCode: id,
    attackCooldownMs: z.number().int().min(500).max(20000),
    meleeDamage: z.number().int().min(1).max(200),
    rangedDamage: z.number().int().min(1).max(200),
    reinforcementCount: z.number().int().min(0).max(6),
  })
  .strict();
export const BOSS_PHASES = Object.freeze([
  {
    schemaVersion: 1,
    id: "phase-1",
    threshold: 1,
    telegraphCode: "boss_attack",
    attackCooldownMs: 3200,
    meleeDamage: 28,
    rangedDamage: 18,
    reinforcementCount: 2,
  },
  {
    schemaVersion: 1,
    id: "phase-2",
    threshold: 0.55,
    telegraphCode: "boss_weak_point",
    attackCooldownMs: 2200,
    meleeDamage: 38,
    rangedDamage: 26,
    reinforcementCount: 3,
  },
] satisfies readonly z.infer<typeof bossPhaseSchema>[]);
export const bossDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    id,
    maxHealth: z.number().int().positive().max(100000),
    phases: z.array(bossPhaseSchema).min(2).max(3),
    weakPointMultiplier: z.number().min(1).max(5),
    rewardScrap: z.number().int().positive().max(5000),
    rewardScore: z.number().int().positive().max(50000),
  })
  .strict();
export const FINAL_BOSS = bossDefinitionSchema.parse({
  schemaVersion: 1,
  id: "abomination-alpha",
  maxHealth: 9000,
  phases: BOSS_PHASES,
  weakPointMultiplier: 1.8,
  rewardScrap: 600,
  rewardScore: 5000,
});
export const MINI_BOSS = Object.freeze({
  id: "brute-alpha",
  archetype: "brute",
  maxHealth: 900,
  rewardScrap: 180,
  rewardScore: 1200,
  specialAttackCooldownMs: 5000,
  telegraphCode: "mini_boss_charge",
});

export const waveProfileSchema = z
  .object({
    profile: phase6ProfileSchema,
    regularWaves: z.number().int().min(5).max(10),
    miniBossWave: z.number().int().min(1).max(10),
    finalBossAfterWave: z.number().int().min(5).max(10),
    intermissionMs: z.number().int().min(100).max(60000),
  })
  .strict();
export const CONTENT_PROFILES = Object.freeze({
  "phase5-test": waveProfileSchema.parse({
    profile: "phase5-test",
    regularWaves: 5,
    miniBossWave: 5,
    finalBossAfterWave: 5,
    intermissionMs: 500,
  }),
  "phase6-production": waveProfileSchema.parse({
    profile: "phase6-production",
    regularWaves: 10,
    miniBossWave: 5,
    finalBossAfterWave: 10,
    intermissionMs: 30000,
  }),
});

export const combatWeaponSchema = z
  .object({
    magazine: z.number().int().nonnegative(),
    reserve: z.number().int().nonnegative(),
    reloadAt: nonNegative,
    nextFireAt: nonNegative,
    lastShot: z.number().int().nonnegative(),
    lastReload: z.number().int().nonnegative(),
  })
  .strict();
export const shopResultCodeSchema = z.enum([
  "accepted",
  "shop_closed",
  "insufficient_scrap",
  "locked_until_wave",
  "already_owned",
  "slot_conflict",
  "inventory_full",
  "invalid_weapon",
  "invalid_state",
  "duplicate_request",
  "unavailable",
]);
export type ShopResultCode = z.infer<typeof shopResultCodeSchema>;
/** Ownership lasts for the run. Two selected slots may be changed only to owned weapons of the matching class. */
export const phase6PlayerStateSchema = z
  .object({
    scrap: z.number().int().min(0).max(9999),
    score: z.number().int().min(0).max(1000000),
    contribution: z.number().int().min(0).max(1000000),
    ownedWeapons: z.array(id).max(5),
    slots: z
      .object({ primary: id.nullable(), secondary: id.nullable() })
      .strict(),
    equippedWeapon: id,
    ammo: z.record(z.string(), combatWeaponSchema),
    lastShot: z.number().int().nonnegative(),
    lastReload: z.number().int().nonnegative(),
    lastEquip: z.number().int().nonnegative(),
    lastTrigger: z.number().int().nonnegative(),
    triggerReleased: z.boolean(),
    nextFireAt: nonNegative,
    upgrades: z.record(z.string(), z.number().int().min(0).max(3)),
    armor: z.number().int().min(0).max(100),
    medkits: z.number().int().min(0).max(3),
    grenades: z.number().int().min(0).max(4),
    sentries: z.number().int().min(0).max(2),
    sentriesDeployed: z.number().int().min(0).max(2),
  })
  .strict();
export type Phase6PlayerState = z.infer<typeof phase6PlayerStateSchema>;
export const objectiveStateSchema = z
  .object({
    id,
    status: z.enum(["AVAILABLE", "ACTIVE", "COMPLETED", "FAILED"]),
    progress: z.number().min(0).max(1),
    revision: z.number().int().min(0),
    activatedBy: id.nullable(),
  })
  .strict();
export const bossStateSchema = z
  .object({
    id,
    kind: z.enum(["MINI_BOSS", "FINAL_BOSS"]),
    health: z.number().int().min(0),
    maxHealth: z.number().int().positive(),
    phase: z.number().int().min(1).max(3),
    state: z.enum(["INTRO", "ACTIVE", "DEFEATED"]),
    revision: z.number().int().min(0),
    telegraphUntil: nonNegative,
  })
  .strict();
export const phase6SnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    profile: phase6ProfileSchema,
    shopOpen: z.boolean(),
    shopUntil: nonNegative,
    players: z.record(id, phase6PlayerStateSchema),
    gates: z.record(
      id,
      z
        .object({
          unlocked: z.boolean(),
          progress: z.number().min(0).max(1),
          revision: z.number().int().min(0),
        })
        .strict(),
    ),
    objectives: z.record(id, objectiveStateSchema),
    miniBoss: bossStateSchema.nullable(),
    boss: bossStateSchema.nullable(),
    outcome: z.enum(["ACTIVE", "VICTORY", "DEFEAT"]).nullable(),
    summary: z.unknown().nullable(),
    revision: z.number().int().min(0),
  })
  .strict();
export type Phase6Snapshot = z.infer<typeof phase6SnapshotSchema>;

export function emptyPhase6Player(weaponId = "ar-01"): Phase6PlayerState {
  const weapon = weaponRegistry.get(weaponId) ?? weaponRegistry.get("ar-01")!;
  return {
    scrap: 0,
    score: 0,
    contribution: 0,
    ownedWeapons: [weapon.id],
    slots: {
      primary: weapon.slot === "primary" ? weapon.id : null,
      secondary: weapon.slot === "secondary" ? weapon.id : null,
    },
    equippedWeapon: weapon.id,
    ammo: {
      [weapon.id]: {
        magazine: weapon.magazineCapacity,
        reserve: weapon.reserveCapacity,
        reloadAt: 0,
        nextFireAt: 0,
        lastShot: 0,
        lastReload: 0,
      },
    },
    lastShot: 0,
    lastReload: 0,
    lastEquip: 0,
    lastTrigger: 0,
    triggerReleased: true,
    nextFireAt: 0,
    upgrades: {},
    armor: 0,
    medkits: 0,
    grenades: 0,
    sentries: 0,
    sentriesDeployed: 0,
  };
}
export function addScrap(
  player: Phase6PlayerState,
  amount: number,
  max = 9999,
) {
  if (!Number.isInteger(amount) || amount < 0)
    throw new Error("Invalid Scrap award");
  player.scrap = Math.min(max, player.scrap + amount);
  return player.scrap;
}
export function spendScrap(player: Phase6PlayerState, amount: number) {
  if (!Number.isInteger(amount) || amount <= 0) return false;
  if (player.scrap < amount) return false;
  player.scrap -= amount;
  return true;
}
export function addScore(
  player: Phase6PlayerState,
  score: number,
  contribution = score,
) {
  player.score = Math.min(
    1000000,
    player.score + Math.max(0, Math.floor(score)),
  );
  player.contribution = Math.min(
    1000000,
    player.contribution + Math.max(0, Math.floor(contribution)),
  );
}
const resolvedStatsCache = new Map<string, WeaponDefinition>();
export function resolveWeaponStats(
  weaponId: string,
  level: number,
): WeaponDefinition {
  const weapon = weaponRegistry.get(weaponId);
  if (!weapon) throw new Error("Unknown weapon");
  const bounded = Math.max(0, Math.min(3, Math.floor(level)));
  const key = weaponId + ":" + bounded;
  const cached = resolvedStatsCache.get(key);
  if (cached) return cached;
  const upgrades = UPGRADES.filter(
    (u) => u.weaponId === weaponId && u.level <= bounded,
  );
  const resolved = Object.freeze({
    ...weapon,
    baseDamage:
      weapon.baseDamage *
      (1 + upgrades.reduce((n, u) => n + u.modifiers.damage, 0)),
    magazineCapacity:
      weapon.magazineCapacity +
      upgrades.reduce((n, u) => n + u.modifiers.magazine, 0),
    reloadMs:
      weapon.reloadMs *
      upgrades.reduce((n, u) => n * u.modifiers.reloadMultiplier, 1),
    fireIntervalMs:
      weapon.fireIntervalMs *
      upgrades.reduce((n, u) => n * u.modifiers.fireIntervalMultiplier, 1),
    spread:
      weapon.spread *
      upgrades.reduce((n, u) => n * u.modifiers.spreadMultiplier, 1),
  });
  resolvedStatsCache.set(key, resolved);
  return resolved;
}
export function canAdvanceToVictory(
  profile: Phase6Profile,
  clearedWaves: number,
  boss: Phase6Snapshot["boss"],
) {
  return (
    clearedWaves >= CONTENT_PROFILES[profile].finalBossAfterWave &&
    !!boss &&
    boss.state === "DEFEATED"
  );
}

for (const value of [
  ...WEAPONS,
  ...UPGRADES,
  ...SHOP_ITEMS,
  ...GATES,
  ...OBJECTIVES,
  ...BOSS_PHASES,
]) {
  if (!value) throw new Error("Invalid Phase 6 definition");
}
