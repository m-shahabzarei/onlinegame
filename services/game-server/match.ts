import { randomInt } from "node:crypto";
import {
  FALLBACK_SPAWN,
  SPAWNS,
  TARGET_HEALTH,
  TARGET_RESET_MS,
  TARGETS,
} from "../../src/game/shared/arena";
import {
  LIMITS,
  MAP_ID,
  MAP_VERSION,
  MOVEMENT,
  SIMULATION,
  type SimulationConfig,
} from "../../src/game/shared/config";
import { terminalState, transition } from "../../src/game/shared/lifecycle";
import {
  ArenaPhysics,
  createMotion,
  playerHeight,
} from "../../src/game/shared/physics";
import {
  GameError,
  neutralInput,
  type ClientMessage,
  type MatchState,
  type PlayerInput,
  type PlayerState,
  type Reservation,
  type ServerMessage,
  type TargetState,
  type WorldSnapshot,
} from "../../src/game/shared/protocol";
import type { JoinClaims } from "../../src/game/shared/tokens";
import {
  completeReload,
  fireWeapon,
  newWeapon,
  reloadWeapon,
  shotDirection,
} from "../../src/game/shared/weapon";
import { RateBudget } from "../../src/game/shared/time";
import {
  newLife,
  waveTerminal,
  type WaveSnapshot,
} from "../../src/game/shared/pve";
import { PvESimulation, type PvEOptions } from "./pve/simulation";
import { eligiblePlayer } from "./pve/targeting";
import { Phase6MatchState, type Phase6Command } from "./phase6";
import { resolveWeaponStats } from "../../src/game/shared/phase6";
export interface Peer {
  send(message: ServerMessage): void;
  close(): void;
}
interface PlayerRuntime {
  state: PlayerState;
  peer: Peer | null;
  inputs: PlayerInput[];
  receivedSeq: number;
  receivedTick: number;
  disconnectedAt: number;
  inputBudget: RateBudget;
  fireBudget: RateBudget;
  commandBudget: RateBudget;
  interactionSeq: number;
}
export class MatchInstance {
  readonly pve: PvESimulation;
  readonly phase6: Phase6MatchState;
  readonly physics: ArenaPhysics;
  readonly players: PlayerRuntime[];
  readonly targets: TargetState[] = TARGETS.map((t) => ({
    id: t.id,
    health: TARGET_HEALTH,
    resetAt: 0,
  }));
  state: MatchState = "BOOTSTRAPPING";
  tick = 0;
  startAt = 0;
  endedAt = 0;
  outcome:
    | {
        result: "PHASE_COMPLETE" | "TEAM_DEFEATED";
        reason: string;
        completedWaves: number;
      }
    | undefined;
  get mode() {
    return this.reservation.mode ?? "coop";
  }
  get requiredPlayers() {
    return this.mode === "solo" ? 1 : 2;
  }
  constructor(
    readonly reservation: Reservation,
    readonly now: () => number,
    readonly lifecycle: (state: MatchState) => void,
    readonly config: SimulationConfig = SIMULATION,
    pveOptions: PvEOptions = {},
  ) {
    this.physics = new ArenaPhysics(1 / config.tickRate);
    this.players = reservation.players.map((p) => {
      const spawn = SPAWNS[p.slot] ?? FALLBACK_SPAWN;
      if (!this.physics.validSpawn(spawn))
        throw new Error("Invalid arena spawn");
      return {
        state: {
          ...createMotion(spawn),
          id: p.playerId,
          slot: p.slot,
          name: p.name,
          connected: false,
          ready: false,
          lastInput: 0,
          health: config.health,
          ...newLife(config.health),
          weapon: newWeapon(),
        },
        peer: null,
        inputs: [],
        receivedSeq: 0,
        receivedTick: 0,
        disconnectedAt: 0,
        inputBudget: new RateBudget(config.inputRate + 3, 12, now()),
        fireBudget: new RateBudget(16, 6, now()),
        commandBudget: new RateBudget(8, 12, now()),
        interactionSeq: 0,
      };
    });
    const soloOptions: PvEOptions = {
      ...pveOptions,
      profile: pveOptions.profile ?? "phase6-production",
    };
    this.phase6 = new Phase6MatchState(
      soloOptions.profile ?? "phase6-production",
      this.players.map((p) => p.state.id),
    );
    for (const p of this.players)
      p.state.weapon = this.phase6.players.get(p.state.id)!.ammo["ar-01"]!;
    this.pve = new PvESimulation(
      this.players.map((p) => p.state),
      this.physics,
      now,
      (m) => this.broadcast(m),
      (wave) => this.finishPvE(wave),
      soloOptions,
    );
    this.change("WAITING_FOR_PLAYERS");
  }
  private finishPvE(wave: WaveSnapshot) {
    if (terminalState(this.state)) return;
    if (wave.state === "INTERMISSION") {
      this.phase6.completeWave(wave.number);
      const now = this.now();
      this.phase6.openShop(now, Math.max(0, wave.until - now));
      this.broadcast({
        v: 3,
        type: "phase6State",
        snapshot: this.phase6.snapshot(),
      });
      return;
    }
    if (
      wave.state === "PHASE_COMPLETE" &&
      this.phase6.profile === "phase6-production" &&
      wave.number >= 10
    ) {
      this.phase6.completeWave(wave.number);
      this.phase6.spawnBoss();
      this.broadcast({
        v: 3,
        type: "phase6State",
        snapshot: this.phase6.snapshot(),
      });
      this.change("BOSS_INTRO");
      return;
    }
    if (wave.state === "PHASE_COMPLETE" || wave.state === "TEAM_DEFEATED") {
      if (wave.state === "TEAM_DEFEATED")
        this.phase6.defeat(wave.reason || "team_defeated");
      this.outcome = {
        result: wave.state,
        reason: wave.reason || "survival_complete",
        completedWaves:
          wave.state === "PHASE_COMPLETE"
            ? wave.number
            : Math.max(0, wave.number - 1),
      };
      this.broadcast({
        v: 3,
        type: "worldSnapshot",
        snapshot: this.snapshot(),
      });
      this.change("ENDED");
    } else if (wave.state === "ERROR") this.change("ERROR");
  }
  private change(next: MatchState) {
    if (this.state === next) return;
    this.state = transition(this.state, next);
    if (terminalState(next)) {
      this.endedAt = this.now();
      if (this.phase6.closeShop(this.now(), true))
        this.broadcast({
          v: 3,
          type: "phase6State",
          snapshot: this.phase6.snapshot(),
        });
    }
    this.broadcast({
      v: 3,
      type: "matchState",
      state: next,
      startAt: this.startAt,
    });
    this.lifecycle(next);
  }
  snapshot(): WorldSnapshot {
    return {
      tick: this.tick,
      time: this.now(),
      state: this.state,
      startAt: this.startAt,
      players: this.players.map((p) => structuredClone(p.state)),
      targets: this.targets.map((t) => ({ ...t })),
      pve: this.pve.snapshot(),
      phase6: this.phase6.snapshot(),
    };
  }
  broadcast(message: ServerMessage) {
    for (const p of this.players) p.peer?.send(message);
  }
  join(claims: JoinClaims, peer: Peer) {
    if (terminalState(this.state)) throw new GameError("MATCH_UNAVAILABLE");
    const expected = this.reservation.players[claims.slot];
    if (!expected) throw new GameError("UNAUTHORIZED");
    if (
      claims.matchId !== this.reservation.matchId ||
      claims.roomId !== this.reservation.roomId ||
      claims.runtimeId !== this.reservation.runtimeId ||
      expected.userId !== claims.userId ||
      expected.kind !== claims.kind ||
      expected.playerId !== claims.playerId
    )
      throw new GameError("UNAUTHORIZED");
    const p = this.players[claims.slot]!;
    if (p.peer) throw new GameError("SLOT_CONNECTED");
    if (
      p.disconnectedAt &&
      this.now() - p.disconnectedAt >= this.config.reconnectMs
    )
      throw new GameError("MATCH_UNAVAILABLE");
    p.peer = peer;
    p.state.connected = true;
    p.state.ready = false;
    p.inputs.length = 0;
    p.receivedSeq = p.state.lastInput;
    p.receivedTick = 0;
    p.interactionSeq = 0;
    this.phase6.players.get(p.state.id)!.triggerReleased = true;
    peer.send({
      v: 3,
      type: "welcome",
      playerId: p.state.id,
      matchId: this.reservation.matchId,
      mode: this.mode,
      slot: claims.slot,
      mapId: MAP_ID,
      mapVersion: MAP_VERSION,
      config: this.config,
      snapshot: this.snapshot(),
    });
    if (
      this.players.filter((p) => p.peer).length >= this.requiredPlayers &&
      this.state === "WAITING_FOR_PLAYERS"
    )
      this.change("LOADING");
    return p.state.id;
  }
  disconnect(playerId: string, peer: Peer) {
    const p = this.players.find((p) => p.state.id === playerId);
    if (!p || p.peer !== peer) return;
    p.peer = null;
    p.state.connected = false;
    p.state.ready = false;
    // An unready reconnect must not renew the original recovery grace.
    if (!p.disconnectedAt) p.disconnectedAt = this.now();
    p.inputs.length = 0;
    if (
      this.pve.revive.current?.reviverId === playerId ||
      this.pve.revive.current?.targetId === playerId
    )
      this.pve.revive.cancel("player_disconnected");
    if (terminalState(this.state)) return;
    if (this.state === "PLAYING" || this.state === "BOSS_ACTIVE")
      this.change("RECONNECTING");
    else if (this.state === "COUNTDOWN" || this.state === "LOADING") {
      this.startAt = 0;
      this.pve.waves.prepare();
      this.change("WAITING_FOR_PLAYERS");
    }
  }
  command(
    playerId: string,
    peer: Peer,
    message: Exclude<ClientMessage, { type: "join" }>,
  ) {
    const p = this.players.find((p) => p.state.id === playerId);
    if (!p || p.peer !== peer) throw new GameError("UNAUTHORIZED");
    const now = this.now();
    const budget =
      message.type === "playerInput"
        ? p.inputBudget
        : message.type === "fire"
          ? p.fireBudget
          : p.commandBudget;
    if (!budget.consume(now)) throw new GameError("RATE_LIMITED");
    if (message.type === "ping") {
      peer.send({
        v: 3,
        type: "pong",
        sentAt: message.sentAt,
        serverTime: now,
      });
      return;
    }
    if (message.type === "leaveMatch") {
      this.end();
      return;
    }
    if (terminalState(this.state) && !("requestId" in message))
      throw new GameError("MATCH_UNAVAILABLE");
    if (message.type === "clientReady") {
      if (message.mapId !== MAP_ID || message.mapVersion !== MAP_VERSION)
        throw new GameError("PROTOCOL_MISMATCH");
      if (p.state.ready) return;
      if (p.disconnectedAt && now - p.disconnectedAt >= this.config.reconnectMs)
        throw new GameError("MATCH_UNAVAILABLE");
      p.state.ready = true;
      p.disconnectedAt = 0;
      if (
        this.players.length >= this.requiredPlayers &&
        this.players.every((p) => p.state.connected && p.state.ready)
      ) {
        if (this.state === "LOADING") {
          this.startAt = now + this.config.countdownMs;
          this.change("COUNTDOWN");
          this.pve.waves.countdown(this.startAt);
        } else if (this.state === "RECONNECTING")
          this.change(this.pve.bossEntityId ? "BOSS_ACTIVE" : "PLAYING");
      }
      return;
    }
    if ("requestId" in message) {
      const result = this.phase6.execute(
        p.state.id,
        message as Phase6Command,
        now,
        ["PLAYING", "RECONNECTING", "BOSS_ACTIVE"].includes(this.state) &&
          eligiblePlayer(p.state) &&
          !this.pve.recoveryPending &&
          this.pve.revive.current?.reviverId !== playerId,
        this.pve.waves.state.state === "INTERMISSION",
      );
      const inventory = this.phase6.players.get(p.state.id)!;
      p.state.weapon = inventory.ammo[inventory.equippedWeapon]!;
      peer.send({
        v: 3,
        type: "shopResult",
        requestId: message.requestId,
        code: result.reason,
        snapshot: result.snapshot,
      });
      if (result.ok)
        this.broadcast({
          v: 3,
          type: "phase6State",
          snapshot: result.snapshot,
        });
      return;
    }
    if (message.type === "triggerRelease") {
      const inventory = this.phase6.players.get(p.state.id)!;
      if (
        message.seq >= inventory.lastTrigger &&
        message.seq <= inventory.lastTrigger + 128
      ) {
        inventory.lastTrigger = message.seq;
        inventory.triggerReleased = true;
      }
      return;
    }
    if (
      !["PLAYING", "RECONNECTING", "BOSS_ACTIVE"].includes(this.state) ||
      !p.state.ready
    )
      throw new GameError("NOT_PLAYING");
    if (message.type === "beginRevive" || message.type === "cancelRevive") {
      if (message.seq <= p.interactionSeq) return;
      if (message.seq > p.interactionSeq + 128)
        throw new GameError("INVALID_MESSAGE");
      p.interactionSeq = message.seq;
      if (message.type === "cancelRevive")
        this.pve.revive.cancel("interact_released", playerId);
      else if (this.pve.combat)
        this.pve.revive.begin(
          p.state,
          this.players.find((other) => other.state.id === message.targetId)
            ?.state,
          now,
        );
      return;
    }
    if (message.type === "playerInput") {
      if (message.seq <= p.receivedSeq) return;
      if (
        message.seq > p.receivedSeq + LIMITS.inputSequenceWindow ||
        Math.abs(message.tick - this.tick) > LIMITS.inputTickWindow ||
        message.tick <= p.receivedTick ||
        p.inputs.length >= LIMITS.inputQueue
      ) {
        // Discard queued intent and acknowledge that discard. A lagging simulation
        // can rebase input time without reconnecting or replaying a rejected backlog.
        p.inputs.length = 0;
        p.state.lastInput = p.receivedSeq;
        p.receivedTick = this.tick;
        peer.send({
          v: 3,
          type: "movementCorrection",
          player: structuredClone(p.state),
          tick: this.tick,
          code: "INPUT_WINDOW",
        });
        throw new GameError("INPUT_WINDOW");
      }
      p.receivedSeq = message.seq;
      p.receivedTick = message.tick;
      p.inputs.push(message);
      return;
    }
    if (
      !eligiblePlayer(p.state) ||
      this.pve.revive.current?.reviverId === playerId ||
      this.pve.recoveryPending
    )
      throw new GameError("NOT_PLAYING");
    if (message.type === "reload") {
      const inventory = this.phase6.players.get(playerId)!;
      if (message.seq <= inventory.lastReload) return;
      if (message.seq > inventory.lastReload + 128)
        throw new GameError("INVALID_RELOAD");
      p.state.weapon.lastReload = inventory.lastReload;
      inventory.lastReload = message.seq;
      const stats = resolveWeaponStats(
        inventory.equippedWeapon,
        inventory.upgrades[inventory.equippedWeapon] ?? 0,
      );
      const started = reloadWeapon(p.state.weapon, message.seq, now, stats);
      peer.send({
        v: 3,
        type: "weaponState",
        weaponId: inventory.equippedWeapon,
        playerId,
        weapon: { ...p.state.weapon },
        event: started ? "reloadStarted" : "unchanged",
      });
      return;
    }
    if (message.type === "fire") {
      const inventory = this.phase6.players.get(playerId)!;
      const stats = resolveWeaponStats(
        inventory.equippedWeapon,
        inventory.upgrades[inventory.equippedWeapon] ?? 0,
      );
      try {
        if (Math.abs(message.tick - this.tick) > LIMITS.inputTickWindow)
          throw new GameError("INPUT_WINDOW");
        if (
          message.viewTick !== undefined &&
          (message.viewTick > this.tick + 2 ||
            message.viewTick <
              this.tick - Math.ceil(this.config.tickRate * 0.6))
        )
          throw new GameError("INPUT_WINDOW");
        if (
          message.seq <= inventory.lastShot ||
          message.seq > inventory.lastShot + 128
        )
          throw new GameError("SHOT_SEQUENCE");
        p.state.weapon.lastShot = inventory.lastShot;
        inventory.lastShot = message.seq;
        if (
          message.triggerSeq < inventory.lastTrigger ||
          message.triggerSeq > inventory.lastTrigger + 128 ||
          (message.triggerSeq === inventory.lastTrigger &&
            (inventory.triggerReleased || stats.fireMode !== "automatic")) ||
          (message.triggerSeq > inventory.lastTrigger &&
            !inventory.triggerReleased)
        )
          throw new GameError("SHOT_SEQUENCE");
        inventory.lastTrigger = message.triggerSeq;
        inventory.triggerReleased = false;
        if (now < inventory.nextFireAt) throw new GameError("FIRE_RATE");
        fireWeapon(p.state.weapon, message.seq, now, stats);
        inventory.nextFireAt = p.state.weapon.nextFireAt;
        const origin = {
          ...p.state.position,
          y: p.state.position.y + playerHeight(p.state) - MOVEMENT.eyeInset,
        };
        const direction = shotDirection(
          message.yaw,
          message.pitch,
          Math.hypot(p.state.velocity.x, p.state.velocity.z) > 0.3,
          () => randomInt(0, 1000000) / 1000000,
          stats,
        );
        const impact = this.physics.raycast(
          origin,
          direction,
          (id) => !!this.targets.find((t) => t.id === id && t.health > 0),
          stats.range,
        );
        const wallDistance = Math.hypot(
          impact.point.x - origin.x,
          impact.point.y - origin.y,
          impact.point.z - origin.z,
        );
        const rewindTick = Math.max(
          this.tick -
            Math.ceil((this.pve.rules.rewindMs * this.config.tickRate) / 1000),
          Math.min(this.tick, message.viewTick ?? this.tick),
        );
        const hit = this.pve.combat
          ? this.pve.damage.hit(
              origin,
              direction,
              wallDistance,
              rewindTick,
              stats.range,
            )
          : null;
        if (hit) {
          const before = hit.zombie.health;
          const deathId = hit.zombie.id + ":" + hit.zombie.spawnAt;
          if (
            this.pve.damage.apply(
              hit.zombie,
              hit.region,
              now,
              this.tick,
              stats,
              playerId,
            )
          ) {
            if (hit.zombie.id === this.pve.bossEntityId) {
              this.phase6.damageBoss(playerId, before - hit.zombie.health);
              hit.zombie.damage = this.phase6.boss!.phase === 2 ? 38 : 28;
              hit.zombie.speed = this.phase6.boss!.phase === 2 ? 1.8 : 1.4;
              if (hit.zombie.health === 0) {
                this.pve.bossEntityId = null;
                this.outcome = {
                  result: "PHASE_COMPLETE",
                  reason: "boss_defeated",
                  completedWaves: this.phase6.clearedWaves,
                };
                this.broadcast({
                  v: 3,
                  type: "phase6State",
                  snapshot: this.phase6.snapshot(),
                });
                this.change("ENDED");
              }
            } else {
              this.phase6.recordDamage(
                playerId,
                before - hit.zombie.health,
                false,
                false,
                playerId + ":" + message.seq,
              );
              if (hit.zombie.health === 0)
                this.phase6.recordKill(
                  playerId,
                  deathId,
                  hit.region === "head",
                );
            }
          }
          impact.point = {
            x: origin.x + direction.x * hit.distance,
            y: origin.y + direction.y * hit.distance,
            z: origin.z + direction.z * hit.distance,
          };
          impact.targetId = hit.zombie.id;
        }
        const target =
          !hit && this.targets.find((t) => t.id === impact.targetId);
        if (target) {
          target.health = Math.max(
            0,
            target.health - Math.ceil(stats.baseDamage),
          );
          if (!target.health) target.resetAt = now + TARGET_RESET_MS;
        }
        this.broadcast({
          v: 3,
          type: "shotConfirmed",
          weaponId: inventory.equippedWeapon,
          playerId,
          seq: message.seq,
          origin,
          ...impact,
          ...(hit
            ? {
                zombieHit: {
                  id: hit.zombie.id,
                  revision: hit.zombie.revision,
                  region: hit.region,
                  killed: hit.zombie.health === 0,
                },
              }
            : {}),
          weapon: { ...p.state.weapon },
        });
      } catch (error) {
        if (!(error instanceof GameError)) throw error;
        peer.send({
          v: 3,
          type: "shotRejected",
          weaponId: inventory.equippedWeapon,
          seq: message.seq,
          code: error.code,
          weapon: { ...p.state.weapon },
        });
      }
    }
  }
  step() {
    if (terminalState(this.state)) return;
    const now = this.now();
    this.tick++;
    if (this.phase6.closeShop(now))
      this.broadcast({
        v: 3,
        type: "phase6State",
        snapshot: this.phase6.snapshot(),
      });
    if (now - this.reservation.createdAt > LIMITS.maxSessionMs) {
      this.end();
      return;
    }
    if (
      !["PLAYING", "RECONNECTING", "BOSS_INTRO", "BOSS_ACTIVE"].includes(
        this.state,
      ) &&
      now - this.reservation.createdAt > this.config.startupMs
    ) {
      this.change("CANCELLED");
      return;
    }
    if (this.state === "COUNTDOWN" && now >= this.startAt)
      this.change("PLAYING");
    if (this.state === "BOSS_INTRO") {
      if (!this.pve.startBoss(now, this.tick, this.phase6.boss!.maxHealth)) {
        this.fail();
        return;
      }
      this.phase6.activateBoss(now);
      this.broadcast({
        v: 3,
        type: "phase6State",
        snapshot: this.phase6.snapshot(),
      });
      this.change("BOSS_ACTIVE");
    }
    for (const p of this.players) {
      const inventory = this.phase6.players.get(p.state.id)!;
      const stats = resolveWeaponStats(
        inventory.equippedWeapon,
        inventory.upgrades[inventory.equippedWeapon] ?? 0,
      );
      if (
        p.state.life === "ALIVE" &&
        completeReload(p.state.weapon, now, stats)
      )
        p.peer?.send({
          v: 3,
          type: "weaponState",
          weaponId: inventory.equippedWeapon,
          playerId: p.state.id,
          weapon: { ...p.state.weapon },
          event: "reloadCompleted",
        });
      if (!["PLAYING", "RECONNECTING", "BOSS_ACTIVE"].includes(this.state))
        continue;
      const input =
        p.state.connected && p.state.ready ? p.inputs.shift() : undefined;
      const neutral = neutralInput(
        p.state.lastInput,
        this.tick,
        p.state.yaw,
        p.state.pitch,
      );
      neutral.crouch = p.state.crouched;
      if (
        p.state.life === "ALIVE" &&
        p.state.connected &&
        p.state.ready &&
        !this.pve.recoveryPending
      )
        this.physics.step(p.state.id, p.state, input ?? neutral);
      else {
        p.state.velocity.x = 0;
        p.state.velocity.y = 0;
        p.state.velocity.z = 0;
        if (input) {
          p.state.yaw = input.yaw;
          p.state.pitch = input.pitch;
        }
      }
      if (input) p.state.lastInput = input.seq;
    }
    const beforeLives = this.players.map((p) => p.state.life);
    this.pve.update(now, this.tick, 1 / this.config.tickRate, (id) => {
      const p = this.players.find((p) => p.state.id === id);
      return p?.disconnectedAt ? p.disconnectedAt + this.config.reconnectMs : 0;
    });
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i]!;
      if (p.state.life !== beforeLives[i]) {
        p.inputs.length = 0;
        p.state.lastInput = p.receivedSeq;
      }
    }
    if (terminalState(this.state)) return;
    for (const t of this.targets)
      if (t.resetAt && now >= t.resetAt) {
        t.health = TARGET_HEALTH;
        t.resetAt = 0;
      }
    if (this.tick % (this.config.tickRate / this.config.snapshotRate) === 0)
      this.broadcast({
        v: 3,
        type: "worldSnapshot",
        snapshot: this.snapshot(),
      });
  }
  end() {
    if (terminalState(this.state)) return;
    this.change(
      this.state === "PLAYING" ||
        this.state === "RECONNECTING" ||
        this.state === "BOSS_ACTIVE" ||
        this.state === "BOSS_INTRO"
        ? "ENDED"
        : "CANCELLED",
    );
    this.pve.cancel();
  }
  fail() {
    if (!terminalState(this.state)) this.change("ERROR");
    if (!waveTerminal(this.pve.waves.state.state)) this.pve.cancel(true);
  }
  dispose() {
    for (const p of this.players) {
      p.peer?.close();
      p.peer = null;
      p.inputs.length = 0;
    }
    this.physics.dispose();
    this.pve.dispose();
  }
}
