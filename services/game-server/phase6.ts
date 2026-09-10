import {
  CONTENT_PROFILES,
  FINAL_BOSS,
  GATES,
  MINI_BOSS,
  OBJECTIVES,
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
  type ShopResultCode,
} from "../../src/game/shared/phase6";
import { newWeapon } from "../../src/game/shared/weapon";

export type Phase6Command =
  | {
      type: "purchaseWeapon";
      requestId: string;
      weaponId: string;
      replaceWeaponId?: string;
    }
  | { type: "purchaseAmmo"; requestId: string; weaponId?: string }
  | { type: "purchaseUpgrade"; requestId: string; upgradeId: string }
  | {
      type:
        | "purchaseArmor"
        | "purchaseMedkit"
        | "purchaseGrenade"
        | "purchaseDeployable";
      requestId: string;
    }
  | {
      type: "equipWeapon";
      requestId: string;
      weaponId: string;
      slot: "primary" | "secondary";
      seq: number;
    }
  | { type: "unlockGate"; requestId: string; gateId: string }
  | {
      type: "beginObjectiveInteraction";
      requestId: string;
      objectiveId: string;
    };

export type Phase6Result = {
  ok: boolean;
  reason: ShopResultCode;
  snapshot: Phase6Snapshot;
};

type PlayerStats = {
  kills: number;
  assists: number;
  damage: number;
  headshots: number;
  revives: number;
  objectives: number;
  gates: number;
  support: number;
  deployable: number;
  miniBossDamage: number;
  bossDamage: number;
  waves: number;
  downs: number;
  eliminations: number;
  timeAliveMs: number;
};

export class Phase6MatchState {
  readonly profile: Phase6Profile;
  readonly players = new Map<string, Phase6PlayerState>();
  readonly stats = new Map<string, PlayerStats>();
  readonly gates = new Map(
    GATES.map((g) => [g.id, { unlocked: false, progress: 0, revision: 0 }]),
  );
  readonly objectives: Map<string, Phase6Snapshot["objectives"][string]> =
    new Map(
      OBJECTIVES.map((o) => [
        o.id,
        {
          id: o.id,
          status: "AVAILABLE" as const,
          progress: 0,
          revision: 0,
          activatedBy: null as string | null,
        },
      ]),
    );
  readonly processed = new Map<string, ShopResultCode>();
  readonly rewardedDeaths = new Set<string>();
  readonly rewardedDamage = new Set<string>();
  shopOpen = false;
  shopUntil = 0;
  revision = 0;
  clearedWaves = 0;
  miniBoss: Phase6Snapshot["miniBoss"] = null;
  boss: Phase6Snapshot["boss"] = null;
  outcome: Phase6Snapshot["outcome"] = "ACTIVE";
  summary: unknown = null;
  constructor(
    profile: Phase6Profile = "phase6-production",
    playerIds: readonly string[] = [],
  ) {
    this.profile = profile;
    for (const id of playerIds) this.addPlayer(id);
  }
  addPlayer(id: string) {
    if (!this.players.has(id)) {
      this.players.set(id, emptyPhase6Player());
      this.stats.set(id, {
        kills: 0,
        assists: 0,
        damage: 0,
        headshots: 0,
        revives: 0,
        objectives: 0,
        gates: 0,
        support: 0,
        deployable: 0,
        miniBossDamage: 0,
        bossDamage: 0,
        waves: 0,
        downs: 0,
        eliminations: 0,
        timeAliveMs: 0,
      });
    }
    return this.players.get(id)!;
  }
  openShop(
    now: number,
    duration = CONTENT_PROFILES[this.profile].intermissionMs,
  ) {
    if (
      this.outcome !== "ACTIVE" ||
      this.shopOpen ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > 60000
    )
      return false;
    this.shopOpen = true;
    this.shopUntil = now + duration;
    this.revision++;
    return true;
  }
  closeShop(now: number, force = false) {
    if (!this.shopOpen || (!force && now < this.shopUntil)) return false;
    this.shopOpen = false;
    this.shopUntil = 0;
    this.revision++;
    return true;
  }
  award(playerId: string, scrap: number, score: number, contribution = score) {
    const p = this.players.get(playerId);
    if (!p || this.outcome !== "ACTIVE") return false;
    addScrap(p, scrap);
    addScore(p, score, contribution);
    this.revision++;
    return true;
  }
  recordKill(playerId: string, deathId: string, headshot = false) {
    const s = this.stats.get(playerId);
    if (!s || this.outcome !== "ACTIVE" || this.rewardedDeaths.has(deathId))
      return false;
    this.rewardedDeaths.add(deathId);
    s.kills++;
    if (headshot) s.headshots++;
    this.award(playerId, 12, 100, 100);
    return true;
  }
  recordDamage(
    playerId: string,
    damage: number,
    boss = false,
    miniBoss = false,
    eventId?: string,
  ) {
    const s = this.stats.get(playerId);
    if (
      !s ||
      this.outcome !== "ACTIVE" ||
      (eventId && this.rewardedDamage.has(eventId))
    )
      return false;
    if (eventId) this.rewardedDamage.add(eventId);
    const bounded = Math.max(0, Math.min(10000, damage));
    const damageScrap =
      Math.floor((s.damage + bounded) / 20) - Math.floor(s.damage / 20);
    s.damage += bounded;
    addScrap(this.players.get(playerId)!, damageScrap);
    if (boss) s.bossDamage += bounded;
    if (miniBoss) s.miniBossDamage += bounded;
    addScore(
      this.players.get(playerId)!,
      Math.floor(bounded),
      Math.floor(bounded * 1.1),
    );
    this.revision++;
    return true;
  }
  completeWave(number: number) {
    if (number > this.clearedWaves) {
      this.clearedWaves = number;
      for (const s of this.stats.values()) s.waves = number;
      for (const id of this.players.keys())
        this.award(id, 50 + number * 10, 250 + number * 50);
      this.revision++;
    }
  }
  spawnMiniBoss() {
    if (this.miniBoss) return this.miniBoss;
    this.miniBoss = {
      id: MINI_BOSS.id,
      kind: "MINI_BOSS",
      health: MINI_BOSS.maxHealth,
      maxHealth: MINI_BOSS.maxHealth,
      phase: 1,
      state: "ACTIVE",
      revision: 1,
      telegraphUntil: 0,
    };
    this.revision++;
    return this.miniBoss;
  }
  spawnBoss() {
    if (this.boss || this.outcome !== "ACTIVE") return this.boss;
    this.boss = {
      id: FINAL_BOSS.id,
      kind: "FINAL_BOSS",
      health: FINAL_BOSS.maxHealth,
      maxHealth: FINAL_BOSS.maxHealth,
      phase: 1,
      state: "INTRO",
      revision: 1,
      telegraphUntil: 0,
    };
    this.revision++;
    return this.boss;
  }
  activateBoss(now: number) {
    if (!this.boss || this.boss.state !== "INTRO") return false;
    this.boss.state = "ACTIVE";
    this.boss.telegraphUntil = now + 1200;
    this.boss.revision++;
    this.revision++;
    return true;
  }
  damageBoss(playerId: string, amount: number, weakPoint = false) {
    if (
      !this.boss ||
      this.boss.state !== "ACTIVE" ||
      !this.players.has(playerId)
    )
      return false;
    const bounded =
      Math.max(0, Math.min(5000, amount)) *
      (weakPoint ? FINAL_BOSS.weakPointMultiplier : 1);
    this.boss.health = Math.max(0, Math.floor(this.boss.health - bounded));
    this.boss.phase = this.boss.health / this.boss.maxHealth <= 0.55 ? 2 : 1;
    this.boss.revision++;
    this.recordDamage(playerId, bounded, true);
    if (this.boss.health === 0) {
      this.boss.state = "DEFEATED";
      for (const id of this.players.keys())
        this.award(id, FINAL_BOSS.rewardScrap, FINAL_BOSS.rewardScore);
      this.outcome = "VICTORY";
      this.summary = this.buildSummary("VICTORY");
    }
    this.revision++;
    return true;
  }
  completeObjective(playerId: string, objectiveId: string) {
    const objective = this.objectives.get(objectiveId);
    if (
      !objective ||
      objective.status === "COMPLETED" ||
      !this.players.has(playerId)
    )
      return false;
    objective.status = "COMPLETED";
    objective.progress = 1;
    objective.activatedBy = playerId;
    objective.revision++;
    const def = OBJECTIVES.find((o) => o.id === objectiveId)!;
    this.award(playerId, def.rewardScrap, def.rewardScore);
    this.stats.get(playerId)!.objectives++;
    this.revision++;
    return true;
  }
  execute(
    playerId: string,
    command: Phase6Command,
    now: number,
    allowed = true,
    shopAvailable = true,
  ): Phase6Result {
    const key = JSON.stringify([playerId, command.requestId]);
    const finish = (reason: ShopResultCode): Phase6Result => {
      // Keep compact receipts for the entire bounded session. Never cache full world snapshots.
      this.processed.set(key, reason);
      return { ok: reason === "accepted", reason, snapshot: this.snapshot() };
    };
    if (this.processed.has(key))
      return {
        ok: false,
        reason: "duplicate_request",
        snapshot: this.snapshot(),
      };
    // Bound hostile unique IDs without evicting receipts and reopening old requests.
    if (this.processed.size >= 16384)
      return { ok: false, reason: "invalid_state", snapshot: this.snapshot() };
    const player = this.players.get(playerId);
    if (!allowed || !player || this.outcome !== "ACTIVE")
      return finish("invalid_state");
    if (
      command.type !== "equipWeapon" &&
      (!shopAvailable || !this.shopOpen || now >= this.shopUntil)
    )
      return finish("shop_closed");
    if (command.type === "purchaseWeapon") {
      const weapon = weaponRegistry.get(command.weaponId);
      if (!weapon) return finish("invalid_weapon");
      if (this.clearedWaves + 1 < weapon.unlockWave)
        return finish("locked_until_wave");
      if (player.ownedWeapons.includes(weapon.id))
        return finish("already_owned");
      const occupied = player.slots[weapon.slot];
      if (occupied && command.replaceWeaponId !== occupied)
        return finish("slot_conflict");
      if (player.ownedWeapons.length >= 5) return finish("inventory_full");
      if (Object.values(player.ammo).some((a) => a.reloadAt > 0))
        return finish("invalid_state");
      if (!spendScrap(player, weapon.shopCost))
        return finish("insufficient_scrap");
      player.ownedWeapons.push(weapon.id);
      player.ammo[weapon.id] = newWeapon(weapon);
      this.selectWeapon(player, weapon.id, now);
    } else if (command.type === "equipWeapon") {
      const weapon = weaponRegistry.get(command.weaponId);
      if (
        !weapon ||
        weapon.slot !== command.slot ||
        !player.ownedWeapons.includes(weapon.id)
      )
        return finish("invalid_weapon");
      if (
        command.seq <= player.lastEquip ||
        command.seq > player.lastEquip + 128
      )
        return finish("invalid_state");
      player.lastEquip = command.seq;
      if (
        Object.values(player.ammo).some((a) => a.reloadAt > 0) ||
        now < player.nextFireAt
      )
        return finish("invalid_state");
      this.selectWeapon(player, weapon.id, now);
    } else if (command.type === "purchaseUpgrade") {
      const upgrade = UPGRADES.find((u) => u.id === command.upgradeId);
      if (!upgrade || !player.ownedWeapons.includes(upgrade.weaponId))
        return finish("invalid_weapon");
      if (
        (player.upgrades[upgrade.weaponId] ?? 0) !==
          upgrade.prerequisiteLevel ||
        player.ammo[upgrade.weaponId]!.reloadAt
      )
        return finish("invalid_state");
      if (!spendScrap(player, upgrade.cost))
        return finish("insufficient_scrap");
      player.upgrades[upgrade.weaponId] = upgrade.level;
    } else if (command.type === "purchaseAmmo") {
      const weaponId = command.weaponId ?? player.equippedWeapon;
      const weapon = weaponRegistry.get(weaponId),
        ammo = player.ammo[weaponId];
      if (!weapon || !ammo || !player.ownedWeapons.includes(weaponId))
        return finish("invalid_weapon");
      if (ammo.reserve >= weapon.reserveCapacity)
        return finish("inventory_full");
      if (!spendScrap(player, 35)) return finish("insufficient_scrap");
      ammo.reserve = weapon.reserveCapacity;
    } else {
      // These definitions currently have no authoritative deployment/use/map effect.
      return finish("unavailable");
    }
    this.revision++;
    return finish("accepted");
  }
  private selectWeapon(
    player: Phase6PlayerState,
    weaponId: string,
    now: number,
  ) {
    const weapon = weaponRegistry.get(weaponId)!;
    player.slots[weapon.slot] = weaponId;
    player.equippedWeapon = weaponId;
    player.nextFireAt = Math.max(
      player.nextFireAt,
      player.ammo[weaponId]!.nextFireAt,
      now + 250,
    );
    // Switching consumes the old press. A new press is required.
    player.triggerReleased = true;
  }
  buildSummary(result: "VICTORY" | "DEFEAT") {
    return {
      result,
      clearedWaves: this.clearedWaves,
      bossDefeated: this.boss?.state === "DEFEATED",
      players: Object.fromEntries(
        [...this.players].map(([id]) => [id, this.stats.get(id)]),
      ),
    };
  }
  defeat(reason = "team_defeated") {
    this.outcome = "DEFEAT";
    this.summary = { ...this.buildSummary("DEFEAT"), reason };
    this.revision++;
  }
  snapshot(): Phase6Snapshot {
    return phase6SnapshotSchema.parse({
      schemaVersion: 1,
      profile: this.profile,
      shopOpen: this.shopOpen,
      shopUntil: this.shopUntil,
      players: Object.fromEntries(this.players),
      gates: Object.fromEntries(this.gates),
      objectives: Object.fromEntries(this.objectives),
      miniBoss: this.miniBoss,
      boss: this.boss,
      outcome: this.outcome,
      summary: this.summary,
      revision: this.revision,
    });
  }
}
