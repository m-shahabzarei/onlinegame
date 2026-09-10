import { randomInt } from "node:crypto";
import {
  ZombieAI,
  waveTerminal,
  type PvEEvent,
  type PvEMetrics,
  type PvESnapshot,
  type WaveSnapshot,
} from "../../../src/game/shared/pve";
import type {
  PlayerState,
  ServerMessage,
} from "../../../src/game/shared/protocol";
import type { ArenaPhysics } from "../../../src/game/shared/physics";
import { PVE_RULES, ZOMBIES, rulesSchema, type PvERules } from "./definitions";
import { ZombieEntityStore } from "./entities";
import { NavigationSystem } from "./navigation";
import { SpawnDirector, seededRandom } from "./spawning";
import { WaveDirector, WAVES, PHASE6_WAVES, type WaveConfig } from "./waves";
import { PlayerLifeStateSystem, ReviveSystem, type EmitEvent } from "./life";
import { eligiblePlayer } from "./targeting";
import { ZombieAISystem, ZombieAttackSystem } from "./ai";
import { DamageSystem } from "./damage";
import type { Phase6Profile } from "../../../src/game/shared/phase6";

export interface PvEOptions {
  seed?: number;
  rules?: PvERules;
  waves?: readonly WaveConfig[];
  profile?: Phase6Profile;
  intermissionMs?: number;
}
export class PvEReplicationSystem {
  static snapshot(sim: PvESimulation, diagnostics: boolean): PvESnapshot {
    const round = (value: number) => Math.round(value * 1000) / 1000;
    return {
      wave: {
        ...sim.waves.state,
        alive: sim.entities.alive,
        queued: sim.waves.queue.length,
      },
      zombies: sim.entities.entities.map((z) => ({
        id: z.id,
        revision: z.revision,
        archetype: z.archetype,
        position: {
          x: round(z.position.x),
          y: round(z.position.y),
          z: round(z.position.z),
        },
        velocity: { x: round(z.velocity.x), y: 0, z: round(z.velocity.z) },
        yaw: round(z.yaw),
        health: z.health,
        maxHealth: z.maxHealth,
        state: z.state,
        stateUntil: z.stateUntil,
        spawnAt: z.spawnAt,
        tick: z.tick,
      })),
      revive: sim.revive.current ? { ...sim.revive.current } : null,
      recoveryPending: sim.recoveryPending,
      eventSeq: sim.eventSeq,
      ...(diagnostics ? { metrics: { ...sim.metrics } } : {}),
    };
  }
}
export class PvESimulation {
  readonly rules: PvERules;
  readonly entities = new ZombieEntityStore();
  readonly navigation = new NavigationSystem();
  readonly waves: WaveDirector;
  readonly spawning: SpawnDirector;
  readonly life: PlayerLifeStateSystem;
  readonly revive: ReviveSystem;
  readonly attacks: ZombieAttackSystem;
  readonly ai: ZombieAISystem;
  readonly damage: DamageSystem;
  recoveryPending = false;
  eventSeq = 0;
  tick = 0;
  readonly metrics: PvEMetrics = {
    aiMs: 0,
    navigationMs: 0,
    pathRequests: 0,
    failedPaths: 0,
    spawnFailures: 0,
    tickMs: 0,
    tickDriftMs: 0,
    rewindMs: 0,
    stuckRecoveries: 0,
  };
  private nextSpawn = 0;
  bossEntityId: string | null = null;
  private lastNow = 0;
  readonly emit: EmitEvent = (kind, values = {}) => {
    const event: PvEEvent = {
      seq: ++this.eventSeq,
      tick: this.tick,
      time: this.now(),
      kind,
      entityId: "",
      revision: 0,
      playerId: "",
      position: { x: 0, y: 0, z: 0 },
      point: { x: 0, y: 0, z: 0 },
      amount: 0,
      until: 0,
      detail: "",
      ...values,
    };
    this.send({ v: 3, type: "pveEvent", event });
  };
  constructor(
    readonly players: readonly PlayerState[],
    readonly physics: ArenaPhysics,
    readonly now: () => number,
    readonly send: (message: ServerMessage) => void,
    readonly finished: (wave: WaveSnapshot) => void,
    options: PvEOptions = {},
  ) {
    this.rules = rulesSchema.parse(options.rules ?? PVE_RULES);
    const random = seededRandom(options.seed ?? randomInt(0, 2147483647));
    this.life = new PlayerLifeStateSystem(this.rules, this.emit);
    this.revive = new ReviveSystem(this.rules, physics, this.emit);
    this.waves = new WaveDirector(
      random,
      (wave) => {
        if (wave.state === "INTERMISSION") {
          this.revive.cancel("wave_cleared");
          this.life.returnAtIntermission(
            this.players,
            this.physics,
            this.navigation,
            this.now(),
          );
        }
        if (waveTerminal(wave.state)) this.revive.cancel("run_ended");
        this.send({
          v: 3,
          type: "waveStateChanged",
          wave,
          seq: ++this.eventSeq,
        });
        if (waveTerminal(wave.state) || wave.state === "INTERMISSION")
          this.finished(wave);
      },
      options.waves ??
        (options.profile === "phase6-production"
          ? PHASE6_WAVES.map((w) => ({
              ...w,
              intermissionMs: options.intermissionMs ?? 30000,
            }))
          : WAVES),
      options.profile === "phase6-production" && !options.waves,
    );
    this.spawning = new SpawnDirector(
      this.navigation,
      physics,
      this.rules,
      random,
    );
    this.attacks = new ZombieAttackSystem(
      physics,
      this.life,
      this.waves,
      this.emit,
    );
    this.ai = new ZombieAISystem(
      this.navigation,
      physics,
      this.rules,
      this.attacks,
    );
    this.damage = new DamageSystem(
      this.entities,
      this.waves,
      this.rules,
      this.emit,
    );
  }
  get combat() {
    return (
      !!this.bossEntityId ||
      this.waves.state.state === "ACTIVE" ||
      this.waves.state.state === "CLEARING"
    );
  }
  startBoss(now: number, tick: number, health: number) {
    const point = this.spawning.select(
      ZOMBIES.get("brute").radius,
      this.players,
      [],
      now,
    );
    if (!point) return null;
    const boss = this.entities.spawn(
      "brute",
      point,
      this.waves.config,
      now,
      tick,
    );
    boss.health = boss.maxHealth = health;
    boss.damage = 28;
    boss.speed = 1.4;
    this.bossEntityId = boss.id;
    this.emit("zombieSpawned", {
      entityId: boss.id,
      revision: boss.revision,
      position: { ...point },
      detail: "brute",
    });
    return boss;
  }
  private teamDefeated() {
    if (this.bossEntityId) {
      this.bossEntityId = null;
      this.finished({
        ...this.waves.state,
        state: "TEAM_DEFEATED",
        reason: "no_living_teammate",
      });
    } else this.waves.change("TEAM_DEFEATED", 0, "no_living_teammate");
  }
  /** Per-player reconnect deadlines come from the match connection owner, never the client. */
  update(
    now: number,
    tick: number,
    dt: number,
    reconnectDeadline: (id: string) => number,
  ) {
    this.tick = tick;
    if (waveTerminal(this.waves.state.state) && !this.bossEntityId) return;
    const elapsed = this.lastNow ? Math.max(0, now - this.lastNow) : 0;
    this.lastNow = now;
    if (this.combat || this.waves.state.state === "INTERMISSION") {
      for (const p of this.players)
        if (
          (!p.connected || !p.ready) &&
          reconnectDeadline(p.id) > 0 &&
          now >= reconnectDeadline(p.id)
        )
          this.life.eliminate(p);
      const living = this.players.some(eligiblePlayer);
      this.recoveryPending =
        !living &&
        this.players.some(
          (p) =>
            p.life === "ALIVE" &&
            (!p.connected || !p.ready) &&
            reconnectDeadline(p.id) > now,
        );
      if (!living && !this.recoveryPending) {
        this.teamDefeated();
        return;
      }
      this.life.bleed(this.players, now, this.recoveryPending ? elapsed : 0);
      this.revive.update(
        this.players,
        now,
        this.combat && !this.recoveryPending,
      );
      if (this.recoveryPending) return;
    }
    if (!this.bossEntityId) this.waves.update(now, this.entities.alive);
    if (!this.combat) return;
    if (
      this.waves.queue.length &&
      this.entities.alive < this.waves.config.cap &&
      now >= this.nextSpawn
    ) {
      const archetype = this.waves.queue[0]!;
      const point = this.spawning.select(
        ZOMBIES.get(archetype).radius,
        this.players,
        this.entities.entities.filter((z) => z.health > 0),
        now,
      );
      this.nextSpawn = now + (point ? 200 : 500);
      if (point) {
        const z = this.entities.spawn(
          archetype,
          point,
          this.waves.config,
          now,
          tick,
        );
        this.waves.spawned();
        this.emit("zombieSpawned", {
          entityId: z.id,
          revision: z.revision,
          position: { ...point },
          detail: archetype,
        });
      } else if (
        this.spawning.consecutiveFailures >= this.rules.spawnFailureLimit
      ) {
        console.warn(
          JSON.stringify({
            event: "pve_spawn_exhausted",
            wave: this.waves.state.number,
            attempts: this.spawning.attempts,
          }),
        );
        this.waves.change("ERROR", 0, "spawn_exhausted");
        return;
      }
    }
    const began = performance.now();
    this.ai.update(this.entities.entities, this.players, now, tick, dt);
    this.metrics.aiMs = performance.now() - began;
    // A lethal attack can make recovery impossible during this tick: stop immediately.
    if (!this.players.some(eligiblePlayer)) {
      this.revive.cancel("no_eligible_reviver");
      this.recoveryPending = this.players.some(
        (p) => p.life === "ALIVE" && reconnectDeadline(p.id) > now,
      );
      if (!this.recoveryPending) this.teamDefeated();
    }
    for (let i = this.entities.entities.length - 1; i >= 0; i--) {
      const z = this.entities.entities[i]!;
      if (z.state === ZombieAI.Dead && now >= z.stateUntil) {
        this.emit("zombieDespawned", { entityId: z.id, revision: z.revision });
        this.entities.remove(z);
      } else if (z.state !== ZombieAI.Dead) this.entities.record(z, tick);
    }
    Object.assign(this.metrics, {
      navigationMs: this.ai.navigationMs,
      pathRequests: this.navigation.requests,
      failedPaths: this.navigation.failed,
      spawnFailures: this.spawning.failures,
      stuckRecoveries: this.ai.stuckRecoveries,
      rewindMs: this.damage.rewindCostMs,
    });
  }
  cancel(error = false) {
    if (!waveTerminal(this.waves.state.state))
      this.waves.change(
        error ? "ERROR" : "CANCELLED",
        0,
        error ? "simulation_failed" : "session_ended",
      );
  }
  snapshot() {
    return PvEReplicationSystem.snapshot(
      this,
      process.env.NODE_ENV !== "production",
    );
  }
  dispose() {
    this.revive.cancel("match_disposed");
    this.entities.dispose();
    this.navigation.dispose();
  }
}
