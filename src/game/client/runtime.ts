import {
  LIMITS,
  MAP_ID,
  MAP_VERSION,
  RIFLE,
  SIMULATION,
} from "../shared/config";
import { terminalState } from "../shared/lifecycle";
import { ArenaPhysics, createMotion, initPhysics } from "../shared/physics";
import {
  copyMotion,
  PredictionBuffer,
  SnapshotBuffer,
} from "../shared/prediction";
import type {
  MatchState,
  ServerMessage,
  WorldSnapshot,
} from "../shared/protocol";
import {
  DEFAULT_SETTINGS,
  settingsSchema,
  SETTINGS_KEY,
  type GameSettings,
} from "../shared/settings";
import { FixedAccumulator } from "../shared/time";
import { GameAudio } from "./audio";
import { GameInput } from "./input";
import { GameplayNetwork, type ConnectionState } from "./network";
import { ArenaRenderer } from "./rendering";
import { INITIAL_PVE_HUD, type PvEHud } from "./pve-hud";
import { emptyWave, type PvEEvent } from "../shared/pve";
import type { GameMode } from "@/domain/lobby";
export interface HudState extends PvEHud {
  connection: ConnectionState;
  mode: GameMode;
  state: MatchState;
  error: string;
  locked: boolean;
  contextLost: boolean;
  health: number;
  magazine: number;
  reserve: number;
  reloading: boolean;
  teammate: string;
  teammateConnected: boolean;
  countdown: number;
  hit: boolean;
  ping: number;
  fps: number;
  frameMs: number;
  serverTick: number;
  snapshotAge: number;
  predictionError: number;
  corrections: number;
  maxCorrection: number;
  inputLatency: number;
  inbound: number;
  outbound: number;
  inboundBytes: number;
  outboundBytes: number;
  drawCalls: number;
  triangles: number;
}
export const INITIAL_HUD: HudState = {
  ...INITIAL_PVE_HUD,
  connection: "Connecting",
  mode: "coop",
  state: "BOOTSTRAPPING",
  error: "",
  locked: false,
  contextLost: false,
  health: 100,
  magazine: 30,
  reserve: 120,
  reloading: false,
  teammate: "Waiting for teammate",
  teammateConnected: false,
  countdown: 0,
  hit: false,
  ping: 0,
  fps: 0,
  frameMs: 0,
  serverTick: 0,
  snapshotAge: 0,
  predictionError: 0,
  corrections: 0,
  maxCorrection: 0,
  inputLatency: 0,
  inbound: 0,
  outbound: 0,
  inboundBytes: 0,
  outboundBytes: 0,
  drawCalls: 0,
  triangles: 0,
};
export class GameRuntime {
  readonly view: ArenaRenderer;
  readonly input: GameInput;
  readonly network: GameplayNetwork;
  readonly audio = new GameAudio();
  readonly prediction = new PredictionBuffer();
  readonly snapshots = new SnapshotBuffer();
  readonly local = createMotion({ x: 0, y: 0.04, z: 14 });
  private remote = createMotion({ x: 0, y: 0, z: 0 });
  private physics = new ArenaPhysics(1 / SIMULATION.tickRate);
  private accumulator = new FixedAccumulator(1 / SIMULATION.tickRate);
  private settings: GameSettings = { ...DEFAULT_SETTINGS };
  private snapshot: WorldSnapshot | null = null;
  private hudMode: GameMode = "coop";
  private selfId = "";
  private seq = 0;
  private tick = 0;
  private shotSeq = 0;
  private reloadSeq = 0;
  private nextFire = 0;
  private hitUntil = 0;
  private feedback = "";
  private feedbackUntil = 0;
  private damageDirection = "";
  private damageUntil = 0;
  private eventSeq = 0;
  private interactionSeq = 0;
  private nextInteract = 0;
  private pathCount = 0;
  private pathRate = 0;
  private idleSoundAt = 0;
  private readonly confirmedShots = new Map<string, number>();
  private disposed = false;
  private sceneReady = false;
  private lost = false;
  private error = "";
  private frame = 0;
  private lastFrame = 0;
  private frameMs = 16.67;
  private uiTimer: ReturnType<typeof setInterval>;
  private rates = {
    inbound: 0,
    outbound: 0,
    inboundBytes: 0,
    outboundBytes: 0,
  };
  private counters = { ...this.rates };
  private ratesAt = performance.now();
  private abort = new AbortController();
  static async create(
    canvas: HTMLCanvasElement,
    settings: GameSettings,
    publish: (hud: HudState) => void,
    matchId: string,
  ) {
    await initPhysics();
    const runtime = new GameRuntime(canvas, settings, publish, matchId);
    try {
      await runtime.view.prepare();
      if (!runtime.disposed) {
        runtime.sceneReady = true;
        void runtime.network.connect();
        runtime.frame = requestAnimationFrame(runtime.render);
      }
      return runtime;
    } catch (error) {
      runtime.dispose();
      throw error;
    }
  }
  private constructor(
    canvas: HTMLCanvasElement,
    settings: GameSettings,
    readonly publish: (hud: HudState) => void,
    matchId: string,
  ) {
    this.settings = settings;
    try {
      this.view = new ArenaRenderer(canvas, (lost) => {
        this.lost = lost;
        this.input.release();
        this.error = lost
          ? "Graphics context lost. Waiting for your browser to restore it…"
          : "";
      });
    } catch (error) {
      this.physics.dispose();
      throw error;
    }
    this.network = new GameplayNetwork(
      matchId,
      (message) => this.receive(message),
      (state, error) => {
        this.error = error;
        if (state !== "Connected") {
          this.input?.release();
          this.prediction.reset();
          this.accumulator.reset();
        }
      },
    );
    this.input = new GameInput(
      canvas,
      () => this.settings,
      () => this.canPlay(),
      (_locked, error) => {
        if (error) this.error = error;
      },
      () => this.reload(),
      (held) => this.interact(held),
    );
    this.uiTimer = setInterval(() => this.sampleHud(), 100);
    document.addEventListener(
      "visibilitychange",
      () => {
        this.accumulator.reset();
        this.lastFrame = 0;
        if (document.hidden) {
          cancelAnimationFrame(this.frame);
        } else if (!this.disposed) {
          this.tick = Math.max(this.tick, this.snapshot?.tick ?? 0);
          this.frame = requestAnimationFrame(this.render);
        }
      },
      { signal: this.abort.signal },
    );
  }
  private self() {
    return this.snapshot?.players.find((p) => p.id === this.selfId);
  }
  private canPlay() {
    return (
      this.network.state === "Connected" &&
      !this.lost &&
      !!this.self()?.ready &&
      !!this.snapshot &&
      ["PLAYING", "RECONNECTING"].includes(this.snapshot.state) &&
      this.network.serverNow() - this.snapshot.time < 1000
    );
  }
  private canFight() {
    return (
      this.canPlay() &&
      this.self()?.life === "ALIVE" &&
      !this.snapshot?.pve.recoveryPending &&
      this.snapshot?.pve.revive?.reviverId !== this.selfId
    );
  }
  private receive(message: ServerMessage) {
    if (message.type === "welcome") {
      this.hudMode = message.mode ?? "coop";
      this.selfId = message.playerId;
      this.tick = message.snapshot.tick;
      this.physics.dispose();
      this.physics = new ArenaPhysics(1 / message.config.tickRate);
      this.accumulator = new FixedAccumulator(1 / message.config.tickRate);
      const self = message.snapshot.players.find((p) => p.id === this.selfId)!;
      copyMotion(this.local, self);
      this.input.yaw = self.yaw;
      this.input.pitch = self.pitch;
      this.seq = self.lastInput;
      this.shotSeq = self.weapon.lastShot;
      this.reloadSeq = self.weapon.lastReload;
      this.prediction.reset(self.lastInput);
      this.snapshots.reset();
      this.snapshot = null;
      this.interactionSeq = 0;
      this.eventSeq = message.snapshot.pve.eventSeq;
      this.confirmedShots.clear();
      this.feedback = "";
      this.feedbackUntil = 0;
      this.damageUntil = 0;
      this.hitUntil = 0;
      this.view.zombies.store.reset(this.eventSeq);
      this.accept(message.snapshot, false);
      this.error = "";
      if (this.sceneReady)
        this.network.send({
          v: 2,
          type: "clientReady",
          mapId: MAP_ID,
          mapVersion: MAP_VERSION,
        });
    } else if (message.type === "pveEvent") {
      if (message.event.seq <= this.eventSeq) return;
      this.eventSeq = message.event.seq;
      this.view.zombies.store.event(message.event);
      this.pveFeedback(message.event);
    } else if (message.type === "waveStateChanged") {
      if (message.seq <= this.eventSeq || !this.snapshot) return;
      this.eventSeq = message.seq;
      this.snapshot.pve.wave = message.wave;
      const state = message.wave.state;
      this.feedback =
        state === "ACTIVE"
          ? `Wave ${message.wave.number} begins`
          : state === "INTERMISSION"
            ? "Wave cleared · regroup and reload"
            : state === "PHASE_COMPLETE"
              ? "Five-wave survival complete"
              : state === "TEAM_DEFEATED"
                ? "Team defeated"
                : "";
      this.feedbackUntil = performance.now() + 2600;
      if (state === "ACTIVE") this.audio.play("waveStart");
      if (state === "INTERMISSION") this.audio.play("waveClear");
      if (state === "PHASE_COMPLETE") this.audio.play("complete");
      if (state === "TEAM_DEFEATED") this.audio.play("defeat");
    } else if (message.type === "worldSnapshot")
      this.accept(message.snapshot, true);
    else if (message.type === "phase6State") {
      if (
        this.snapshot &&
        message.snapshot.revision >= (this.snapshot.phase6?.revision ?? -1)
      ) {
        this.snapshot.phase6 = message.snapshot;
      }
    } else if (message.type === "matchState") {
      if (this.snapshot) {
        this.snapshot.state = message.state;
        this.snapshot.startAt = message.startAt;
      }
      if (terminalState(message.state)) {
        this.input.release();
        this.network.dispose();
        this.error =
          message.state === "ERROR"
            ? "The gameplay server ended this session. Return to rooms to try again."
            : message.state === "CANCELLED"
              ? "The session was cancelled before both players were ready."
              : "The cooperative session has ended.";
      }
    } else if (message.type === "movementCorrection") {
      this.prediction.reset(message.player.lastInput);
      copyMotion(this.local, message.player);
      // A timing rebase must preserve currently held intent. Focus loss and
      // disconnect still release input; clearing here strands a held key.
      this.seq = message.player.lastInput;
      this.tick = message.tick;
      this.accumulator.reset();
    } else if (message.type === "shotConfirmed") {
      if (message.seq <= (this.confirmedShots.get(message.playerId) ?? 0))
        return;
      this.confirmedShots.set(message.playerId, message.seq);
      this.view.impact(
        message.origin,
        message.point,
        this.settings.screenFlashes && !this.settings.reducedMotion,
      );
      if (message.playerId === this.selfId) {
        const self = this.self();
        if (self) self.weapon = message.weapon;
        if (message.targetId) {
          this.hitUntil = performance.now() + 220;
          this.audio.play("impact");
          if (message.zombieHit) {
            this.feedback = message.zombieHit.killed
              ? "Zombie eliminated"
              : message.zombieHit.region === "head"
                ? "Headshot"
                : "Confirmed hit";
            this.feedbackUntil =
              performance.now() + (message.zombieHit.killed ? 900 : 400);
          }
        }
      } else {
        this.view.remoteShot();
        this.audio.play("fire", message.origin);
      }
    } else if (message.type === "shotRejected") {
      const self = this.self();
      if (self) self.weapon = message.weapon;
      if (message.code === "EMPTY") this.audio.play("empty");
    } else if (message.type === "weaponState") {
      const self = this.self();
      if (self && message.playerId === this.selfId) {
        self.weapon = message.weapon;
        if (message.event === "reloadStarted") this.audio.play("reload");
      }
    }
  }
  private accept(snapshot: WorldSnapshot, reconcile: boolean) {
    if (this.snapshot && snapshot.tick <= this.snapshot.tick) return;
    const previousLife = this.self()?.life;
    const previousWave = this.snapshot?.pve.wave;
    if (previousWave && previousWave.revision > snapshot.pve.wave.revision)
      snapshot.pve.wave = previousWave;
    this.snapshot = snapshot;
    this.eventSeq = Math.max(this.eventSeq, snapshot.pve.eventSeq);
    this.snapshots.push(snapshot);
    this.view.updateTargets(snapshot.targets);
    this.view.zombies.store.accept(
      snapshot.pve.zombies,
      snapshot.tick,
      snapshot.time,
    );
    const self = this.self();
    if (self && reconcile) {
      if (self.life !== "ALIVE" || previousLife !== self.life) {
        this.prediction.reset(self.lastInput);
        copyMotion(this.local, self);
      } else this.prediction.reconcile(this.local, self, this.physics);
    }
    if (!this.input.locked && self) {
      this.input.yaw = self.yaw;
      this.input.pitch = self.pitch;
    }
  }
  private simulate = () => {
    this.tick++;
    if (!this.canPlay()) return;
    this.tick = Math.max(this.tick, this.snapshot?.tick ?? 0);
    const input = this.input.collect(++this.seq, this.tick);
    if (this.self()?.life !== "ALIVE" || this.snapshot?.pve.recoveryPending) {
      input.x = 0;
      input.z = 0;
      input.jump = false;
      input.sprint = false;
      this.local.yaw = input.yaw;
      this.local.pitch = input.pitch;
      this.network.send(input);
      return;
    }
    if (!this.prediction.push(input)) {
      this.input.release();
      this.network.retry();
      return;
    }
    this.physics.step(this.selfId, this.local, input);
    this.network.send(input);
  };
  private render = (time: number) => {
    if (this.disposed || document.hidden) return;
    const delta = this.lastFrame
      ? Math.min(0.15, (time - this.lastFrame) / 1000)
      : 0;
    this.lastFrame = time;
    if (delta > 0) this.frameMs = this.frameMs * 0.95 + delta * 1000 * 0.05;
    if (!this.lost) {
      this.accumulator.advance(delta, this.simulate);
      this.prediction.smooth(delta);
      const teammate = this.snapshot?.players.find((p) => p.id !== this.selfId);
      const state = teammate
        ? this.snapshots.sample(
            teammate.id,
            this.network.serverNow(),
            this.remote,
          )
        : undefined;
      this.view.remoteState(this.remote, state, time);
      if (
        this.input.firing &&
        this.input.active() &&
        this.canFight() &&
        time >= this.nextFire
      ) {
        this.nextFire = time + RIFLE.fireIntervalMs;
        const weapon = this.self()?.weapon;
        if (weapon && !weapon.reloadAt) {
          if (weapon.magazine) {
            this.view.localShot();
            this.audio.play("fire");
            this.network.send({
              v: 2,
              type: "fire",
              seq: ++this.shotSeq,
              tick: this.tick,
              viewTick: Math.max(
                0,
                Math.floor(
                  (this.snapshot?.tick ?? 0) +
                    (this.network.serverNow() -
                      (this.snapshot?.time ?? 0) -
                      LIMITS.interpolationMs) /
                      (this.accumulator.step * 1000),
                ),
              ),
              yaw: this.input.yaw,
              pitch: this.input.pitch,
            });
          } else this.audio.play("empty");
        }
      }
      this.view.zombies.render(
        this.network.serverNow(),
        this.view.camera,
        this.settings.reducedMotion,
        this.settings.screenFlashes,
      );
      this.view.weaponVisible(this.self()?.life === "ALIVE");
      this.view.render(
        this.local,
        this.prediction.visualOffset,
        this.input,
        this.settings,
        delta,
        !!this.self()?.weapon.reloadAt,
      );
      this.audio.listener(
        this.view.camera.position,
        this.input.yaw,
        this.input.pitch,
      );
    }
    this.frame = requestAnimationFrame(this.render);
  };
  private sampleHud() {
    if (this.disposed) return;
    const now = performance.now(),
      seconds = (now - this.ratesAt) / 1000;
    if (seconds >= 1) {
      const paths = this.snapshot?.pve.metrics?.pathRequests ?? 0;
      this.pathRate = Math.max(0, paths - this.pathCount) / seconds;
      this.pathCount = paths;
      for (const key of [
        "inbound",
        "outbound",
        "inboundBytes",
        "outboundBytes",
      ] as const) {
        this.rates[key] = (this.network[key] - this.counters[key]) / seconds;
        this.counters[key] = this.network[key];
      }
      this.ratesAt = now;
    }
    const self = this.self(),
      teammate = this.snapshot?.players.find((p) => p.id !== this.selfId);
    if (this.input.interacting && now >= this.nextInteract) this.interact(true);
    const serverNow = this.network.serverNow(),
      pve = this.snapshot?.pve,
      phase6 = this.snapshot?.phase6,
      revive = pve?.revive;
    if (now >= this.idleSoundAt && this.canPlay()) {
      this.idleSoundAt = now + 1800;
      let nearest = Infinity,
        zombie;
      for (const z of pve?.zombies ?? []) {
        const d = Math.hypot(
          z.position.x - this.local.position.x,
          z.position.z - this.local.position.z,
        );
        if (z.health > 0 && d < nearest) {
          nearest = d;
          zombie = z;
        }
      }
      if (zombie && nearest < 18)
        this.audio.play("zombieIdle", zombie.position);
      if (revive) this.audio.play("reviveProgress");
    }
    const snapshotAge = this.snapshot
      ? Math.max(0, this.network.serverNow() - this.snapshot.time)
      : 0;
    this.publish({
      wave: pve?.wave ?? emptyWave(),
      life: self?.life ?? "ALIVE",
      maxHealth: self?.maxHealth ?? 100,
      bleedOutSeconds: Math.max(
        0,
        Math.ceil(((self?.bleedOutAt ?? 0) - serverNow) / 1000),
      ),
      teammateLife: teammate?.life ?? "ALIVE",
      teammateHealth: teammate?.health ?? 100,
      intermission: Math.max(
        0,
        Math.ceil(((pve?.wave.until ?? 0) - serverNow) / 1000),
      ),
      revivePrompt: !!this.reviveTarget(),
      reviveProgress: revive
        ? Math.max(
            0,
            Math.min(
              1,
              (serverNow - revive.startedAt) /
                (revive.endsAt - revive.startedAt),
            ),
          )
        : 0,
      reviving: !!revive,
      recoveryPending: pve?.recoveryPending ?? false,
      feedback: now < this.feedbackUntil ? this.feedback : "",
      damageDirection: now < this.damageUntil ? this.damageDirection : "",
      pooledZombies: this.view.zombies.store.pooled,
      activeZombies: this.view.zombies.store.active.size,
      zombieCorrections: this.view.zombies.store.slots.reduce(
        (n, s) => n + s.corrections,
        0,
      ),
      pveMetrics: pve?.metrics ?? null,
      pathRequestsPerSecond: this.pathRate,
      connection: this.network.state,
      mode: this.hudMode,
      state: this.snapshot?.state ?? "BOOTSTRAPPING",
      error: this.error,
      locked: this.input.locked,
      contextLost: this.lost,
      health: self?.health ?? 100,
      magazine: self?.weapon.magazine ?? 30,
      reserve: self?.weapon.reserve ?? 120,
      reloading: !!self?.weapon.reloadAt,
      teammate: teammate?.name ?? "Waiting for teammate",
      teammateConnected: teammate?.connected ?? false,
      countdown: Math.max(
        0,
        Math.ceil(
          ((this.snapshot?.startAt ?? 0) - this.network.serverNow()) / 1000,
        ),
      ),
      hit: now < this.hitUntil,
      ping: this.network.ping,
      fps: Math.round(1000 / this.frameMs),
      frameMs: this.frameMs,
      serverTick: this.snapshot?.tick ?? 0,
      snapshotAge,
      predictionError: this.prediction.error,
      corrections: this.prediction.corrections,
      maxCorrection: this.prediction.maxCorrection,
      inputLatency:
        this.prediction.pending.length * this.accumulator.step * 1000,
      ...this.rates,
      drawCalls: this.view.renderer.info.render.calls,
      triangles: this.view.renderer.info.render.triangles,
      scrap: phase6?.players[this.selfId]?.scrap ?? 0,
      score: phase6?.players[this.selfId]?.score ?? 0,
      contribution: phase6?.players[this.selfId]?.contribution ?? 0,
      armor: phase6?.players[this.selfId]?.armor ?? 0,
      medkits: phase6?.players[this.selfId]?.medkits ?? 0,
      grenades: phase6?.players[this.selfId]?.grenades ?? 0,
      sentries: phase6?.players[this.selfId]?.sentries ?? 0,
      shopOpen: phase6?.shopOpen ?? false,
      shopUntil: phase6?.shopUntil ?? 0,
      bossHealth: phase6?.boss?.health ?? 0,
      bossMaxHealth: phase6?.boss?.maxHealth ?? 0,
      bossPhase: phase6?.boss?.phase ?? 0,
      bossActive: phase6?.boss?.state === "ACTIVE",
      phase6Outcome: phase6?.outcome ?? null,
      ownedWeapons: phase6?.players[this.selfId]?.ownedWeapons ?? ["ar-01"],
      equippedWeapon: phase6?.players[this.selfId]?.equippedWeapon ?? "ar-01",
      phase6Profile: phase6?.profile ?? "phase6-production",
    });
  }
  reload() {
    if (this.input.active() && this.canFight())
      this.network.send({ v: 2, type: "reload", seq: ++this.reloadSeq });
  }
  purchasePhase6(
    kind:
      "weapon" | "ammo" | "upgrade" | "armor" | "medkit" | "grenade" | "sentry",
    id?: string,
  ) {
    if (!this.canPlay()) return;
    const requestId =
      globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
    const type =
      kind === "weapon"
        ? "purchaseWeapon"
        : kind === "ammo"
          ? "purchaseAmmo"
          : kind === "upgrade"
            ? "purchaseUpgrade"
            : kind === "armor"
              ? "purchaseArmor"
              : kind === "medkit"
                ? "purchaseMedkit"
                : kind === "grenade"
                  ? "purchaseGrenade"
                  : "purchaseDeployable";
    this.network.send({
      v: 2,
      type,
      requestId,
      ...(id ? { [kind === "weapon" ? "weaponId" : "upgradeId"]: id } : {}),
    } as never);
  }
  private reviveTarget() {
    if (this.hudMode === "solo") return;
    if (!this.canPlay() || this.self()?.life !== "ALIVE") return;
    return this.snapshot?.players.find(
      (p) =>
        p.id !== this.selfId &&
        p.life === "DOWNED" &&
        p.connected &&
        p.ready &&
        Math.hypot(
          p.position.x - this.local.position.x,
          p.position.y - this.local.position.y,
          p.position.z - this.local.position.z,
        ) <= 2.4,
    );
  }
  private interact(held: boolean) {
    if (!held) {
      this.network.send({
        v: 2,
        type: "cancelRevive",
        seq: ++this.interactionSeq,
      });
      return;
    }
    this.nextInteract = performance.now() + 250;
    const target = this.reviveTarget();
    if (target && this.input.active())
      this.network.send({
        v: 2,
        type: "beginRevive",
        seq: ++this.interactionSeq,
        targetId: target.id,
      });
  }
  private pveFeedback(event: PvEEvent) {
    if (event.kind === "zombieAttackTelegraph") {
      this.audio.play(
        event.detail === "scream"
          ? "scream"
          : event.detail === "brute"
            ? "brute"
            : event.detail === "spitter"
              ? "spitter"
              : "zombieAttack",
        event.position,
      );
      if (
        event.detail === "scream" ||
        event.detail === "brute" ||
        event.detail === "spitter"
      ) {
        this.feedback =
          event.detail === "scream"
            ? "Screamer calling reinforcements"
            : event.detail === "spitter"
              ? "Spitter aiming · move"
              : "Brute winding up";
        this.feedbackUntil = performance.now() + 1600;
      }
    }
    if (event.kind === "zombieAttackResolved") {
      this.audio.play(
        event.detail === "spitter" ? "spit" : "zombieImpact",
        event.position,
      );
      if (event.detail === "spitter")
        this.view.impact(
          event.position,
          event.point,
          this.settings.screenFlashes && !this.settings.reducedMotion,
        );
    }
    if (event.kind === "zombieDied")
      this.audio.play("zombieDeath", event.position);
    if (event.kind === "playerDamaged" && event.playerId === this.selfId) {
      this.audio.play("damaged");
      const angle =
        Math.atan2(
          event.position.x - this.local.position.x,
          -(event.position.z - this.local.position.z),
        ) + this.input.yaw;
      const relative = Math.atan2(Math.sin(angle), Math.cos(angle));
      this.damageDirection =
        Math.abs(relative) < Math.PI / 4
          ? "Damage from ahead"
          : Math.abs(relative) > Math.PI * 0.75
            ? "Damage from behind"
            : relative > 0
              ? "Damage from right"
              : "Damage from left";
      this.damageUntil = performance.now() + 900;
    }
    if (event.kind === "playerLifeStateChanged" && event.detail === "DOWNED")
      this.audio.play("downed");
    if (event.kind === "reviveCompleted") {
      this.audio.play("reviveComplete");
      this.feedback = "Teammate revived";
      this.feedbackUntil = performance.now() + 1800;
    }
    if (event.kind === "reviveCancelled") {
      this.feedback = "Revive interrupted";
      this.feedbackUntil = performance.now() + 1000;
    }
  }
  enter() {
    if (!this.canPlay()) return;
    this.error = "";
    void this.audio.unlock(this.settings.volume).catch(() => {
      this.error = "Audio is unavailable. Gameplay remains connected.";
    });
    void this.input.enter();
  }
  pause() {
    this.input.release();
  }
  retry() {
    this.network.retry();
  }
  configure(settings: GameSettings) {
    const parsed = settingsSchema.safeParse(settings);
    if (!parsed.success) return;
    this.settings = parsed.data;
    this.audio.volume(this.settings.volume);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch {
      /* Storage may be disabled; changes remain active for this session. */
    }
  }
  async leave() {
    this.input.release();
    try {
      await this.network.leave();
    } finally {
      this.dispose();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frame);
    clearInterval(this.uiTimer);
    this.abort.abort();
    this.input.dispose();
    this.network.dispose();
    this.audio.dispose();
    this.physics.dispose();
    this.view.dispose();
    this.prediction.reset();
    this.snapshots.reset();
  }
}
