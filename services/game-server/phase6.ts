import {
  CONTENT_PROFILES,
  FINAL_BOSS,
  GATES,
  MINI_BOSS,
  OBJECTIVES,
  SHOP_ITEMS,
  UPGRADES,
  addScore,
  addScrap,
  emptyPhase6Player,
  phase6SnapshotSchema,
  weaponRegistry,
  spendScrap,
  type Phase6PlayerState,
  type Phase6Profile,
  type Phase6Snapshot,
} from "../../src/game/shared/phase6";

export type Phase6Command =
  | { type: "purchaseWeapon"; requestId: string; weaponId: string }
  | { type: "purchaseAmmo"; requestId: string; weaponId?: string }
  | { type: "purchaseUpgrade"; requestId: string; upgradeId: string }
  | { type: "purchaseArmor" | "purchaseMedkit" | "purchaseGrenade" | "purchaseDeployable"; requestId: string }
  | { type: "equipWeapon"; requestId: string; weaponId: string }
  | { type: "unlockGate"; requestId: string; gateId: string }
  | { type: "beginObjectiveInteraction"; requestId: string; objectiveId: string };

export type Phase6Result = { ok: true; reason: "accepted"; snapshot: Phase6Snapshot } | { ok: false; reason: "shop-closed" | "insufficient-scrap" | "already-owned" | "inventory-full" | "requirement-not-met" | "invalid-state" | "purchase-already-processed"; snapshot: Phase6Snapshot };

type PlayerStats = { kills: number; assists: number; damage: number; headshots: number; revives: number; objectives: number; gates: number; support: number; deployable: number; miniBossDamage: number; bossDamage: number; waves: number; downs: number; eliminations: number; timeAliveMs: number };

export class Phase6MatchState {
  readonly profile: Phase6Profile;
  readonly players = new Map<string, Phase6PlayerState>();
  readonly stats = new Map<string, PlayerStats>();
  readonly gates = new Map(GATES.map((g) => [g.id, { unlocked: false, progress: 0, revision: 0 }]));
  readonly objectives: Map<string, Phase6Snapshot["objectives"][string]> = new Map(OBJECTIVES.map((o) => [o.id, { id: o.id, status: "AVAILABLE" as const, progress: 0, revision: 0, activatedBy: null as string | null }]));
  readonly processed = new Map<string, Phase6Result>();
  shopOpen = false;
  shopUntil = 0;
  revision = 0;
  clearedWaves = 0;
  miniBoss: Phase6Snapshot["miniBoss"] = null;
  boss: Phase6Snapshot["boss"] = null;
  outcome: Phase6Snapshot["outcome"] = "ACTIVE";
  summary: unknown = null;
  constructor(profile: Phase6Profile = "phase6-production", playerIds: readonly string[] = []) {
    this.profile = profile;
    for (const id of playerIds) this.addPlayer(id);
  }
  addPlayer(id: string) { if (!this.players.has(id)) { this.players.set(id, emptyPhase6Player()); this.stats.set(id, { kills: 0, assists: 0, damage: 0, headshots: 0, revives: 0, objectives: 0, gates: 0, support: 0, deployable: 0, miniBossDamage: 0, bossDamage: 0, waves: 0, downs: 0, eliminations: 0, timeAliveMs: 0 }); } return this.players.get(id)!; }
  openShop(now: number, duration = CONTENT_PROFILES[this.profile].intermissionMs) { if (this.outcome !== "ACTIVE") return false; this.shopOpen = true; this.shopUntil = now + duration; this.revision++; return true; }
  closeShop(now: number) { if (!this.shopOpen || now < this.shopUntil) return false; this.shopOpen = false; this.shopUntil = 0; this.revision++; return true; }
  award(playerId: string, scrap: number, score: number, contribution = score) { const p = this.players.get(playerId); if (!p || this.outcome !== "ACTIVE") return false; addScrap(p, scrap); addScore(p, score, contribution); this.revision++; return true; }
  recordKill(playerId: string, damage = 0, headshot = false) { const s = this.stats.get(playerId); if (!s) return false; s.kills++; s.damage += Math.max(0, damage); if (headshot) s.headshots++; this.award(playerId, 12, 100 + damage, 100 + damage); return true; }
  recordDamage(playerId: string, damage: number, boss = false, miniBoss = false) { const s = this.stats.get(playerId); if (!s) return false; const bounded = Math.max(0, Math.min(10000, damage)); s.damage += bounded; if (boss) s.bossDamage += bounded; if (miniBoss) s.miniBossDamage += bounded; addScore(this.players.get(playerId)!, Math.floor(bounded), Math.floor(bounded * 1.1)); this.revision++; return true; }
  completeWave(number: number) { if (number > this.clearedWaves) { this.clearedWaves = number; for (const s of this.stats.values()) s.waves = number; for (const id of this.players.keys()) this.award(id, 50 + number * 10, 250 + number * 50); this.revision++; } }
  spawnMiniBoss() { if (this.miniBoss) return this.miniBoss; this.miniBoss = { id: MINI_BOSS.id, kind: "MINI_BOSS", health: MINI_BOSS.maxHealth, maxHealth: MINI_BOSS.maxHealth, phase: 1, state: "ACTIVE", revision: 1, telegraphUntil: 0 }; this.revision++; return this.miniBoss; }
  spawnBoss() { if (this.boss || this.outcome !== "ACTIVE") return this.boss; this.boss = { id: FINAL_BOSS.id, kind: "FINAL_BOSS", health: FINAL_BOSS.maxHealth, maxHealth: FINAL_BOSS.maxHealth, phase: 1, state: "INTRO", revision: 1, telegraphUntil: 0 }; this.revision++; return this.boss; }
  activateBoss(now: number) { if (!this.boss || this.boss.state !== "INTRO") return false; this.boss.state = "ACTIVE"; this.boss.telegraphUntil = now + 1200; this.boss.revision++; this.revision++; return true; }
  damageBoss(playerId: string, amount: number, weakPoint = false) { if (!this.boss || this.boss.state !== "ACTIVE" || !this.players.has(playerId)) return false; const bounded = Math.max(0, Math.min(5000, amount)) * (weakPoint ? FINAL_BOSS.weakPointMultiplier : 1); this.boss.health = Math.max(0, Math.floor(this.boss.health - bounded)); this.boss.phase = this.boss.health / this.boss.maxHealth <= 0.55 ? 2 : 1; this.boss.revision++; this.recordDamage(playerId, bounded, true); if (this.boss.health === 0) { this.boss.state = "DEFEATED"; this.outcome = "VICTORY"; this.summary = this.buildSummary("VICTORY"); } this.revision++; return true; }
  completeObjective(playerId: string, objectiveId: string) { const objective = this.objectives.get(objectiveId); if (!objective || objective.status === "COMPLETED" || !this.players.has(playerId)) return false; objective.status = "COMPLETED"; objective.progress = 1; objective.activatedBy = playerId; objective.revision++; const def = OBJECTIVES.find((o) => o.id === objectiveId)!; this.award(playerId, def.rewardScrap, def.rewardScore); this.stats.get(playerId)!.objectives++; this.revision++; return true; }
  execute(playerId: string, command: Phase6Command, now: number): Phase6Result { const prior = this.processed.get(command.requestId); if (prior) return { ok: false, reason: "purchase-already-processed", snapshot: this.snapshot() }; const player = this.players.get(playerId); if (!player) return this.reject(command.requestId, "invalid-state"); if (command.type !== "equipWeapon" && command.type !== "beginObjectiveInteraction" && (!this.shopOpen || now >= this.shopUntil)) return this.reject(command.requestId, "shop-closed"); let result: Phase6Result;
    if (command.type === "purchaseWeapon") { const weapon = weaponRegistry.get(command.weaponId); if (!weapon || this.clearedWaves + 1 < weapon.unlockWave) result = this.reject(command.requestId, "requirement-not-met"); else if (player.ownedWeapons.includes(weapon.id)) result = this.reject(command.requestId, "already-owned"); else if (player.ownedWeapons.length >= 2) result = this.reject(command.requestId, "inventory-full"); else if (!spendScrap(player, weapon.shopCost)) result = this.reject(command.requestId, "insufficient-scrap"); else { player.ownedWeapons.push(weapon.id); player.ammo[weapon.id] = { magazine: weapon.magazineCapacity, reserve: weapon.reserveCapacity }; this.revision++; result = this.accept(); } }
    else if (command.type === "equipWeapon") { if (!player.ownedWeapons.includes(command.weaponId)) result = this.reject(command.requestId, "requirement-not-met"); else { player.equippedWeapon = command.weaponId; this.revision++; result = this.accept(); } }
    else if (command.type === "purchaseUpgrade") { const upgrade = UPGRADES.find((u) => u.id === command.upgradeId); const level = upgrade ? player.upgrades[upgrade.weaponId] ?? 0 : 0; if (!upgrade || !player.ownedWeapons.includes(upgrade.weaponId) || level !== upgrade.prerequisiteLevel) result = this.reject(command.requestId, "requirement-not-met"); else if (!spendScrap(player, upgrade.cost)) result = this.reject(command.requestId, "insufficient-scrap"); else { player.upgrades[upgrade.weaponId] = upgrade.level; this.revision++; result = this.accept(); } }
    else if (command.type === "purchaseAmmo") { const weaponId = command.weaponId ?? player.equippedWeapon; const weapon = weaponRegistry.get(weaponId); const ammo = player.ammo[weaponId]; if (!weapon || !ammo || !spendScrap(player, 35)) result = this.reject(command.requestId, "insufficient-scrap"); else { ammo.reserve = weapon.reserveCapacity; this.revision++; result = this.accept(); } }
    else if (["purchaseArmor", "purchaseMedkit", "purchaseGrenade", "purchaseDeployable"].includes(command.type)) { const item = SHOP_ITEMS.find((i) => i.kind === ({ purchaseArmor: "armor", purchaseMedkit: "medkit", purchaseGrenade: "grenade", purchaseDeployable: "sentry" } as Record<string, string>)[command.type]); if (!item || !spendScrap(player, item.cost)) result = this.reject(command.requestId, "insufficient-scrap"); else { if (command.type === "purchaseArmor") player.armor = Math.min(100, player.armor + 25); if (command.type === "purchaseMedkit") player.medkits = Math.min(3, player.medkits + 1); if (command.type === "purchaseGrenade") player.grenades = Math.min(4, player.grenades + 1); if (command.type === "purchaseDeployable") player.sentries = Math.min(2, player.sentries + 1); this.revision++; result = this.accept(); } }
    else if (command.type === "unlockGate") { const gate = GATES.find((g) => g.id === command.gateId); const state = this.gates.get(command.gateId); if (!gate || !state || this.clearedWaves < gate.minimumWave || state.unlocked || !spendScrap(player, gate.cost)) result = this.reject(command.requestId, "requirement-not-met"); else { state.unlocked = true; state.progress = 1; state.revision++; this.stats.get(playerId)!.gates++; this.revision++; result = this.accept(); } }
    else { const objectiveId = command.type === "beginObjectiveInteraction" ? command.objectiveId : ""; const objective = OBJECTIVES.find((o) => o.id === objectiveId); if (!objective || this.clearedWaves + 1 < objective.availableWave) result = this.reject(command.requestId, "requirement-not-met"); else { result = this.accept(); } }
    this.processed.set(command.requestId, result); return result;
  }
  private reject(requestId: string, reason: Phase6Result["reason"]) { const result: Phase6Result = { ok: false, reason: reason as Exclude<Phase6Result["reason"], "accepted">, snapshot: this.snapshot() }; this.processed.set(requestId, result); return result; }
  private accept(): Phase6Result { return { ok: true, reason: "accepted", snapshot: this.snapshot() }; }
  buildSummary(result: "VICTORY" | "DEFEAT") { return { result, clearedWaves: this.clearedWaves, bossDefeated: this.boss?.state === "DEFEATED", players: Object.fromEntries([...this.players].map(([id]) => [id, this.stats.get(id)])) }; }
  defeat(reason = "Team defeated") { this.outcome = "DEFEAT"; this.summary = { ...this.buildSummary("DEFEAT"), reason }; this.revision++; }
  snapshot(): Phase6Snapshot { return phase6SnapshotSchema.parse({ schemaVersion: 1, profile: this.profile, shopOpen: this.shopOpen, shopUntil: this.shopUntil, players: Object.fromEntries(this.players), gates: Object.fromEntries(this.gates), objectives: Object.fromEntries(this.objectives), miniBoss: this.miniBoss, boss: this.boss, outcome: this.outcome, summary: this.summary, revision: this.revision }); }
}




