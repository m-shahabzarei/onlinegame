import { FALLBACK_SPAWN, SPAWNS } from "../../../src/game/shared/arena";
import { RIFLE } from "../../../src/game/shared/config";
import {
  createMotion,
  type ArenaPhysics,
} from "../../../src/game/shared/physics";
import type { PlayerState, Vec3 } from "../../../src/game/shared/protocol";
import type { PvEEvent, ReviveSnapshot } from "../../../src/game/shared/pve";
import type { PvERules } from "./definitions";
import { eligiblePlayer } from "./targeting";
import {
  horizontalDistance,
  lineOfSight,
  NavigationSystem,
} from "./navigation";

export type EmitEvent = (
  kind: PvEEvent["kind"],
  values?: Partial<Omit<PvEEvent, "kind" | "seq" | "time" | "tick">>,
) => void;
export class PlayerLifeStateSystem {
  constructor(
    readonly rules: PvERules,
    readonly emit: EmitEvent,
  ) {}
  damage(p: PlayerState, amount: number, now: number, source: Vec3) {
    if (
      !eligiblePlayer(p) ||
      now < p.protectedUntil ||
      !Number.isFinite(amount) ||
      amount <= 0
    )
      return false;
    amount = Math.ceil(amount);
    p.health = Math.max(0, p.health - amount);
    p.lastDamageAt = now;
    this.emit("playerDamaged", {
      playerId: p.id,
      amount,
      position: source,
      point: { ...p.position },
    });
    if (p.health === 0) {
      p.life = "DOWNED";
      p.bleedOutAt = now + this.rules.bleedOutMs;
      p.weapon.reloadAt = 0;
      p.velocity.x = 0;
      p.velocity.y = 0;
      p.velocity.z = 0;
      p.sprinting = false;
      this.emit("playerLifeStateChanged", {
        playerId: p.id,
        detail: p.life,
        until: p.bleedOutAt,
      });
    }
    return true;
  }
  eliminate(p: PlayerState) {
    if (p.life === "ELIMINATED") return;
    p.life = "ELIMINATED";
    p.health = 0;
    p.bleedOutAt = 0;
    p.protectedUntil = 0;
    p.weapon.reloadAt = 0;
    p.velocity.x = 0;
    p.velocity.y = 0;
    p.velocity.z = 0;
    this.emit("playerLifeStateChanged", { playerId: p.id, detail: p.life });
  }
  bleed(players: readonly PlayerState[], now: number, pausedMs: number) {
    for (const p of players)
      if (p.life === "DOWNED") {
        p.bleedOutAt += pausedMs;
        if (now >= p.bleedOutAt) this.eliminate(p);
      }
  }
  returnAtIntermission(
    players: readonly PlayerState[],
    physics: ArenaPhysics,
    nav: NavigationSystem,
    now: number,
  ) {
    for (const p of players) {
      // Connected downed players recover at intermission too; no helpless timer during a break.
      if (!p.connected || !p.ready) continue;
      if (p.life !== "ALIVE") {
        const spawn = [...SPAWNS, FALLBACK_SPAWN].find(
          (s) =>
            physics.validSpawn(s) &&
            nav.nearest(s, 1.5) !== -1 &&
            players.every(
              (other) =>
                other === p || horizontalDistance(s, other.position) > 0.8,
            ),
        );
        if (!spawn) throw new Error("No safe intermission player spawn");
        Object.assign(p, createMotion(spawn));
        p.life = "ALIVE";
        p.health = Math.ceil(p.maxHealth * this.rules.returnHealth);
        p.bleedOutAt = 0;
        p.protectedUntil = now + this.rules.protectionMs;
        this.emit("playerLifeStateChanged", {
          playerId: p.id,
          detail: "RETURNED",
          position: { ...spawn },
        });
      }
      // Free between-wave reserve resupply of the existing rifle; no item or economy.
      p.weapon.reserve = Math.max(p.weapon.reserve, RIFLE.reserve);
      p.weapon.reloadAt = 0;
    }
  }
}
export class ReviveSystem {
  current: ReviveSnapshot | null = null;
  private nextId = 0;
  private heldUntil = 0;
  constructor(
    readonly rules: PvERules,
    readonly physics: ArenaPhysics,
    readonly emit: EmitEvent,
  ) {}
  valid(
    reviver: PlayerState | undefined,
    target: PlayerState | undefined,
    now: number,
  ) {
    return (
      !!reviver &&
      !!target &&
      reviver !== target &&
      eligiblePlayer(reviver) &&
      target.connected &&
      target.ready &&
      target.life === "DOWNED" &&
      now < target.bleedOutAt &&
      horizontalDistance(reviver.position, target.position) <=
        this.rules.reviveRange &&
      Math.abs(reviver.position.y - target.position.y) < 1.2 &&
      lineOfSight(
        this.physics,
        { ...reviver.position, y: reviver.position.y + 0.8 },
        { ...target.position, y: target.position.y + 0.8 },
      )
    );
  }
  begin(reviver: PlayerState, target: PlayerState | undefined, now: number) {
    if (!this.valid(reviver, target, now)) return false;
    if (this.current) {
      if (
        this.current.reviverId !== reviver.id ||
        this.current.targetId !== target!.id
      )
        return false;
      this.heldUntil = now + 750;
      return true;
    }
    this.current = {
      id: ++this.nextId,
      reviverId: reviver.id,
      targetId: target!.id,
      startedAt: now,
      endsAt: now + this.rules.reviveMs,
    };
    this.heldUntil = now + 750;
    reviver.weapon.reloadAt = 0;
    this.emit("reviveStarted", {
      playerId: reviver.id,
      entityId: target!.id,
      until: this.current.endsAt,
    });
    return true;
  }
  cancel(reason: string, reviverId?: string) {
    if (!this.current || (reviverId && this.current.reviverId !== reviverId))
      return false;
    this.emit("reviveCancelled", {
      playerId: this.current.reviverId,
      entityId: this.current.targetId,
      detail: reason,
    });
    this.current = null;
    this.heldUntil = 0;
    return true;
  }
  update(players: readonly PlayerState[], now: number, active: boolean) {
    const r = this.current;
    if (!r) return;
    const reviver = players.find((p) => p.id === r.reviverId),
      target = players.find((p) => p.id === r.targetId);
    if (!active || now > this.heldUntil || !this.valid(reviver, target, now)) {
      this.cancel("Interaction interrupted");
      return;
    }
    if (now < r.endsAt) return;
    target!.life = "ALIVE";
    target!.health = Math.ceil(target!.maxHealth * this.rules.reviveHealth);
    target!.bleedOutAt = 0;
    target!.protectedUntil = now + this.rules.protectionMs;
    this.current = null;
    this.heldUntil = 0;
    this.emit("reviveCompleted", {
      playerId: reviver!.id,
      entityId: target!.id,
      amount: target!.health,
    });
    this.emit("playerLifeStateChanged", {
      playerId: target!.id,
      detail: "ALIVE",
    });
  }
}
