import { z } from "zod";
import { archetypeSchema, type Archetype } from "../../../src/game/shared/pve";

export enum AttackKind {
  Melee,
  Spit,
  Scream,
}
export const definitionSchema = z
  .object({
    id: archetypeSchema,
    cost: z.number().int().min(1).max(8),
    health: z.number().int().min(1).max(500),
    speed: z.number().min(0.5).max(5.5),
    acceleration: z.number().min(1).max(20),
    radius: z.number().min(0.25).max(0.6),
    height: z.number().min(1).max(2.6),
    damage: z.number().int().min(0).max(50),
    attack: z.enum(AttackKind),
    range: z.number().min(1).max(20),
    preferredRange: z.number().min(0).max(14),
    windupMs: z.number().int().min(400).max(4000),
    recoveryMs: z.number().int().min(300).max(4000),
    cooldownMs: z.number().int().min(1000).max(20000),
    staggerMs: z.number().int().min(0).max(600),
    staggerDamage: z.number().min(1).max(1000),
    specialCalls: z.number().int().min(0).max(2),
    packageSize: z.number().int().min(0).max(3),
  })
  .strict();
export type ZombieDefinition = z.infer<typeof definitionSchema>;
const definitions: ZombieDefinition[] = [
  {
    id: "walker",
    cost: 1,
    health: 65,
    speed: 1.7,
    acceleration: 6,
    radius: 0.34,
    height: 1.8,
    damage: 14,
    attack: AttackKind.Melee,
    range: 1.35,
    preferredRange: 0,
    windupMs: 800,
    recoveryMs: 900,
    cooldownMs: 1900,
    staggerMs: 150,
    staggerDamage: 25,
    specialCalls: 0,
    packageSize: 0,
  },
  {
    id: "runner",
    cost: 1,
    health: 45,
    speed: 3.8,
    acceleration: 9,
    radius: 0.3,
    height: 1.65,
    damage: 11,
    attack: AttackKind.Melee,
    range: 1.2,
    preferredRange: 0,
    windupMs: 600,
    recoveryMs: 800,
    cooldownMs: 1700,
    staggerMs: 300,
    staggerDamage: 20,
    specialCalls: 0,
    packageSize: 0,
  },
  {
    id: "spitter",
    cost: 2,
    health: 70,
    speed: 1.9,
    acceleration: 6,
    radius: 0.34,
    height: 1.75,
    damage: 16,
    attack: AttackKind.Spit,
    range: 17,
    preferredRange: 10,
    windupMs: 1200,
    recoveryMs: 1100,
    cooldownMs: 3800,
    staggerMs: 150,
    staggerDamage: 40,
    specialCalls: 0,
    packageSize: 0,
  },
  {
    id: "brute",
    cost: 3,
    health: 220,
    speed: 1.2,
    acceleration: 3,
    radius: 0.58,
    height: 2.4,
    damage: 32,
    attack: AttackKind.Melee,
    range: 1.9,
    preferredRange: 0,
    windupMs: 1600,
    recoveryMs: 1800,
    cooldownMs: 3600,
    staggerMs: 0,
    staggerDamage: 1000,
    specialCalls: 0,
    packageSize: 0,
  },
  {
    id: "screamer",
    cost: 2,
    health: 85,
    speed: 2,
    acceleration: 6,
    radius: 0.34,
    height: 1.9,
    damage: 9,
    attack: AttackKind.Scream,
    range: 14,
    preferredRange: 8,
    windupMs: 2400,
    recoveryMs: 1600,
    cooldownMs: 14000,
    staggerMs: 200,
    staggerDamage: 40,
    specialCalls: 1,
    packageSize: 2,
  },
];
export class ZombieDefinitionRegistry {
  private readonly definitions = new Map<
    Archetype,
    Readonly<ZombieDefinition>
  >();
  constructor(values: readonly ZombieDefinition[] = definitions) {
    for (const value of values) {
      const valid = definitionSchema.parse(value);
      if (this.definitions.has(valid.id))
        throw new Error("Duplicate zombie definition");
      this.definitions.set(valid.id, Object.freeze(valid));
    }
    if (this.definitions.size !== 5)
      throw new Error("Phase 5 requires exactly five archetypes");
  }
  get(id: Archetype) {
    return this.definitions.get(id)!;
  }
}
export const ZOMBIES = new ZombieDefinitionRegistry();
export const rulesSchema = z
  .object({
    bleedOutMs: z.number().int().min(1000).max(60000),
    reviveMs: z.number().int().min(500).max(10000),
    reviveRange: z.number().min(1).max(3),
    reviveHealth: z.number().min(0.25).max(0.75),
    returnHealth: z.number().min(0.25).max(1),
    protectionMs: z.number().int().min(0).max(2500),
    minSpawnDistance: z.number().min(4).max(16),
    maxSpawnDistance: z.number().min(18).max(60),
    spawnAttempts: z.number().int().min(4).max(64),
    spawnFailureLimit: z.number().int().min(1).max(60),
    pathRequestsPerTick: z.number().int().min(1).max(4),
    pathIntervalMs: z.number().int().min(200).max(1000),
    targetIntervalMs: z.number().int().min(125).max(250),
    targetHysteresis: z.number().min(0.4).max(0.85),
    stuckMs: z.number().int().min(1000).max(6000),
    despawnMs: z.number().int().min(300).max(1500),
    rewindMs: z.number().int().min(100).max(250),
    headMultiplier: z.number().min(1.2).max(3),
    bodyMultiplier: z.number().min(0.5).max(1.5),
  })
  .strict()
  .refine((r) => r.maxSpawnDistance > r.minSpawnDistance);
export type PvERules = z.infer<typeof rulesSchema>;
export const PVE_RULES = Object.freeze(
  rulesSchema.parse({
    bleedOutMs: 30000,
    reviveMs: 5000,
    reviveRange: 2.4,
    reviveHealth: 0.45,
    returnHealth: 1,
    protectionMs: 1800,
    minSpawnDistance: 8,
    maxSpawnDistance: 48,
    spawnAttempts: 32,
    spawnFailureLimit: 20,
    pathRequestsPerTick: 2,
    pathIntervalMs: 400,
    targetIntervalMs: 200,
    targetHysteresis: 0.65,
    stuckMs: 2500,
    despawnMs: 900,
    rewindMs: 200,
    headMultiplier: 2,
    bodyMultiplier: 1,
  }),
);
