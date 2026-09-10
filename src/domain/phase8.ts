import { z } from "zod";

export const challengeCadenceSchema = z.enum(["DAILY", "WEEKLY"]);
export const challengeUnitSchema = z.enum([
  "MATCH_COMPLETED",
  "WAVE_CLEARED",
  "REVIVE",
  "OBJECTIVE_COMPLETED",
  "MINI_BOSS_DEFEATED",
  "BOSS_DEFEATED",
  "DAMAGE",
  "HEADSHOT",
]);
export const challengeDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    cadence: challengeCadenceSchema,
    target: z.number().int().positive().max(100_000),
    unit: challengeUnitSchema,
    displayCopy: z.string().min(1).max(180),
    rewardCosmeticId: z.string().regex(/^[a-z0-9-]+$/),
  })
  .strict();
export type ChallengeDefinition = z.infer<typeof challengeDefinitionSchema>;

export const CHALLENGES = Object.freeze([
  {
    id: "daily-complete-run",
    version: 1,
    cadence: "DAILY",
    target: 1,
    unit: "MATCH_COMPLETED",
    displayCopy: "Complete one cooperative run",
    rewardCosmeticId: "badge-first-light",
  },
  {
    id: "daily-revive",
    version: 1,
    cadence: "DAILY",
    target: 1,
    unit: "REVIVE",
    displayCopy: "Revive your teammate once",
    rewardCosmeticId: "title-field-medic",
  },
  {
    id: "weekly-objectives",
    version: 1,
    cadence: "WEEKLY",
    target: 3,
    unit: "OBJECTIVE_COMPLETED",
    displayCopy: "Complete three optional objectives",
    rewardCosmeticId: "banner-quarantine",
  },
] satisfies readonly ChallengeDefinition[]);

for (const definition of CHALLENGES)
  challengeDefinitionSchema.parse(definition);

export const cosmeticKindSchema = z.enum([
  "AVATAR_FRAME",
  "BADGE",
  "BANNER",
  "TITLE",
  "EMOTE",
  "WEAPON_APPEARANCE",
  "MENU_THEME",
  "LOBBY_EFFECT",
]);
export const cosmeticDefinitionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().positive(),
    kind: cosmeticKindSchema,
    displayName: z.string().min(1).max(80),
    assetKey: z.string().regex(/^[a-z0-9/_-]+$/),
    enabled: z.boolean().default(true),
  })
  .strict();
export type CosmeticDefinition = z.infer<typeof cosmeticDefinitionSchema>;

export const COSMETICS = Object.freeze([
  {
    id: "badge-first-light",
    version: 1,
    kind: "BADGE",
    displayName: "First Light",
    assetKey: "cosmetics/badges/first-light",
    enabled: true,
  },
  {
    id: "title-field-medic",
    version: 1,
    kind: "TITLE",
    displayName: "Field Medic",
    assetKey: "cosmetics/titles/field-medic",
    enabled: true,
  },
  {
    id: "banner-quarantine",
    version: 1,
    kind: "BANNER",
    displayName: "Quarantine Line",
    assetKey: "cosmetics/banners/quarantine",
    enabled: true,
  },
] satisfies readonly CosmeticDefinition[]);

for (const definition of COSMETICS) cosmeticDefinitionSchema.parse(definition);

export function advanceChallengeProgress(
  current: number,
  delta: number,
  target: number,
  completedAt: Date | null = null,
) {
  if (!Number.isInteger(current) || current < 0)
    throw new Error("Invalid challenge progress");
  if (!Number.isInteger(delta) || delta < 0)
    throw new Error("Invalid challenge delta");
  const progress = Math.min(target, current + delta);
  return {
    progress,
    completed: progress >= target,
    completedAt: progress >= target ? (completedAt ?? new Date()) : null,
  };
}

export function cosmeticIsGameplayNeutral(
  kind: z.infer<typeof cosmeticKindSchema>,
) {
  void kind;
  return true;
}
