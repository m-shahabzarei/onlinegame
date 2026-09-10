import { z } from "zod";

/** Presentation state only. Paths, targets, seeds and AI scheduling stay server-side. */
export enum ZombieAI {
  Spawning,
  Chasing,
  Windup,
  Recovery,
  Staggered,
  Dead,
}
export const archetypeSchema = z.enum([
  "walker",
  "runner",
  "spitter",
  "brute",
  "screamer",
]);
export type Archetype = z.infer<typeof archetypeSchema>;
export const lifeSchema = z.enum(["ALIVE", "DOWNED", "ELIMINATED"]);
export type LifeState = z.infer<typeof lifeSchema>;
export const lifeFields = {
  life: lifeSchema,
  maxHealth: z.number().int().positive().max(1000),
  bleedOutAt: z.number().nonnegative().finite(),
  protectedUntil: z.number().nonnegative().finite(),
  lastDamageAt: z.number().nonnegative().finite(),
};
export const newLife = (maxHealth = 100) => ({
  life: "ALIVE" as const,
  maxHealth,
  bleedOutAt: 0,
  protectedUntil: 0,
  lastDamageAt: 0,
});
const count = z.number().int().nonnegative().max(2147483647);
const time = z.number().finite().nonnegative();
const id = z.string().max(128);
const vec = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
export const waveStateSchema = z.enum([
  "PREPARING",
  "COUNTDOWN",
  "ACTIVE",
  "CLEARING",
  "INTERMISSION",
  "PHASE_COMPLETE",
  "TEAM_DEFEATED",
  "CANCELLED",
  "ERROR",
]);
export type WaveState = z.infer<typeof waveStateSchema>;
export const waveSchema = z
  .object({
    state: waveStateSchema,
    number: z.number().int().min(0).max(10),
    total: z.union([z.literal(5), z.literal(10)]),
    revision: count,
    until: time,
    planned: count,
    scheduled: count,
    queued: count,
    alive: count,
    defeated: count,
    reinforcements: count,
    reinforcementLimit: count,
    reason: z.string().max(120),
  })
  .strict();
export type WaveSnapshot = z.infer<typeof waveSchema>;
export const emptyWave = (): WaveSnapshot => ({
  state: "PREPARING",
  number: 0,
  total: 5,
  revision: 0,
  until: 0,
  planned: 0,
  scheduled: 0,
  queued: 0,
  alive: 0,
  defeated: 0,
  reinforcements: 0,
  reinforcementLimit: 0,
  reason: "",
});
export const zombieSchema = z
  .object({
    id: id.min(1),
    revision: count,
    archetype: archetypeSchema,
    position: vec,
    velocity: vec,
    yaw: z.number().finite(),
    health: count,
    maxHealth: count,
    state: z.enum(ZombieAI),
    stateUntil: time,
    spawnAt: time,
    tick: count,
  })
  .strict();
export type ZombieSnapshot = z.infer<typeof zombieSchema>;
export const reviveSchema = z
  .object({
    id: count,
    reviverId: id.min(1),
    targetId: id.min(1),
    startedAt: time,
    endsAt: time,
  })
  .strict();
export type ReviveSnapshot = z.infer<typeof reviveSchema>;
export const pveMetricsSchema = z
  .object({
    aiMs: time,
    navigationMs: time,
    pathRequests: count,
    failedPaths: count,
    spawnFailures: count,
    tickMs: time,
    tickDriftMs: time,
    rewindMs: time,
    stuckRecoveries: count,
  })
  .strict();
export type PvEMetrics = z.infer<typeof pveMetricsSchema>;
export const pveSnapshotSchema = z
  .object({
    wave: waveSchema,
    zombies: z.array(zombieSchema).max(48),
    revive: reviveSchema.nullable(),
    recoveryPending: z.boolean(),
    eventSeq: count,
    metrics: pveMetricsSchema.optional(),
  })
  .strict();
export type PvESnapshot = z.infer<typeof pveSnapshotSchema>;
export const emptyPvE = (): PvESnapshot => ({
  wave: emptyWave(),
  zombies: [],
  revive: null,
  recoveryPending: false,
  eventSeq: 0,
});
export const pveEventSchema = z
  .object({
    seq: count,
    tick: count,
    time,
    kind: z.enum([
      "zombieSpawned",
      "zombieDamaged",
      "zombieDied",
      "zombieDespawned",
      "zombieAttackTelegraph",
      "zombieAttackResolved",
      "playerDamaged",
      "playerLifeStateChanged",
      "reviveStarted",
      "reviveCancelled",
      "reviveCompleted",
    ]),
    entityId: id,
    revision: count,
    playerId: id,
    position: vec,
    point: vec,
    amount: count,
    until: time,
    detail: z.string().max(120),
  })
  .strict();
export type PvEEvent = z.infer<typeof pveEventSchema>;
export const waveTerminal = (state: WaveState) =>
  state === "PHASE_COMPLETE" ||
  state === "TEAM_DEFEATED" ||
  state === "CANCELLED" ||
  state === "ERROR";
export const outcomeSchema = z
  .object({
    result: z.enum(["PHASE_COMPLETE", "TEAM_DEFEATED"]),
    reason: z.string().max(120),
    completedWaves: z.number().int().min(0).max(5),
  })
  .strict();
export type PvEOutcome = z.infer<typeof outcomeSchema>;
