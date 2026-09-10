import { ZombieAI } from "../../../src/game/shared/pve";
import type { ArenaPhysics } from "../../../src/game/shared/physics";
import type { PlayerState, Vec3 } from "../../../src/game/shared/protocol";
import { AttackKind, ZOMBIES, type PvERules } from "./definitions";
import { zombieTransition, type ZombieEntity } from "./entities";
import {
  horizontalDistance,
  lineOfSight,
  NavigationSystem,
  groundHeight,
} from "./navigation";
import { eligiblePlayer, TargetSelectionSystem } from "./targeting";
import type { EmitEvent, PlayerLifeStateSystem } from "./life";
import type { WaveDirector } from "./waves";

const chest = (p: Vec3, height = 1) => ({ x: p.x, y: p.y + height, z: p.z });
export class ZombieAttackSystem {
  constructor(
    readonly physics: ArenaPhysics,
    readonly life: PlayerLifeStateSystem,
    readonly waves: WaveDirector,
    readonly emit: EmitEvent,
  ) {}
  kind(z: ZombieEntity) {
    const d = ZOMBIES.get(z.archetype);
    return d.attack === AttackKind.Scream && z.calls >= d.specialCalls
      ? AttackKind.Melee
      : d.attack;
  }
  range(z: ZombieEntity) {
    return this.kind(z) === AttackKind.Melee && z.archetype === "screamer"
      ? 1.35
      : ZOMBIES.get(z.archetype).range;
  }
  canStart(z: ZombieEntity, target: PlayerState, now: number) {
    return (
      z.state === ZombieAI.Chasing &&
      z.health > 0 &&
      eligiblePlayer(target) &&
      now >= z.cooldownAt &&
      horizontalDistance(z.position, target.position) <= this.range(z) &&
      Math.abs(z.position.y - target.position.y) < 1.8 &&
      lineOfSight(this.physics, chest(z.position), chest(target.position))
    );
  }
  start(z: ZombieEntity, target: PlayerState, now: number, tick: number) {
    if (!this.canStart(z, target, now)) return false;
    const d = ZOMBIES.get(z.archetype);
    z.attackKind = this.kind(z);
    z.attackTargetId = target.id;
    Object.assign(
      z.attackPoint,
      chest(target.position, target.crouched ? 0.65 : 1),
    );
    zombieTransition(z, ZombieAI.Windup, now + d.windupMs, tick);
    this.emit("zombieAttackTelegraph", {
      entityId: z.id,
      revision: z.revision,
      playerId: target.id,
      position: chest(z.position),
      point: { ...z.attackPoint },
      until: z.stateUntil,
      detail: z.attackKind === AttackKind.Scream ? "scream" : z.archetype,
    });
    return true;
  }
  resolve(
    z: ZombieEntity,
    players: readonly PlayerState[],
    now: number,
    tick: number,
  ) {
    if (z.state !== ZombieAI.Windup || z.health <= 0 || now < z.stateUntil)
      return;
    const d = ZOMBIES.get(z.archetype),
      target = players.find((p) => p.id === z.attackTargetId);
    zombieTransition(z, ZombieAI.Recovery, now + d.recoveryMs, tick);
    z.cooldownAt = now + d.cooldownMs;
    let amount = 0;
    if (
      target &&
      eligiblePlayer(target) &&
      horizontalDistance(z.position, target.position) <= this.range(z) &&
      Math.abs(z.position.y - target.position.y) < 1.8 &&
      lineOfSight(this.physics, chest(z.position), chest(target.position))
    ) {
      if (z.attackKind === AttackKind.Scream && z.calls < d.specialCalls) {
        z.calls++;
        amount = this.waves.reinforce(d.packageSize);
      } else if (z.attackKind === AttackKind.Spit) {
        // A visible fixed aim point is committed at windup. Repositioning dodges this ranged strike.
        const origin = chest(z.position),
          dx = z.attackPoint.x - origin.x,
          dy = z.attackPoint.y - origin.y,
          dz = z.attackPoint.z - origin.z;
        const body = chest(target.position, target.crouched ? 0.65 : 1),
          length2 = dx * dx + dy * dy + dz * dz;
        const t = Math.max(
          0,
          Math.min(
            1.05,
            ((body.x - origin.x) * dx +
              (body.y - origin.y) * dy +
              (body.z - origin.z) * dz) /
              (length2 || 1),
          ),
        );
        const miss = Math.hypot(
          body.x - origin.x - dx * t,
          body.y - origin.y - dy * t,
          body.z - origin.z - dz * t,
        );
        if (
          miss <= 0.5 &&
          lineOfSight(this.physics, origin, body) &&
          this.life.damage(target, z.damage, now, z.position)
        )
          amount = z.damage;
      } else if (this.life.damage(target, z.damage, now, z.position))
        amount = z.damage;
    }
    this.emit("zombieAttackResolved", {
      entityId: z.id,
      revision: z.revision,
      playerId: z.attackTargetId,
      position: chest(z.position),
      point: { ...z.attackPoint },
      amount,
      detail: z.attackKind === AttackKind.Scream ? "scream" : z.archetype,
    });
    z.attackTargetId = "";
  }
}
export class ZombieAISystem {
  readonly targeting: TargetSelectionSystem;
  navigationMs = 0;
  stuckRecoveries = 0;
  private desired: Vec3 = { x: 0, y: 0, z: 0 };
  private candidate: Vec3 = { x: 0, y: 0, z: 0 };
  constructor(
    readonly nav: NavigationSystem,
    readonly physics: ArenaPhysics,
    readonly rules: PvERules,
    readonly attacks: ZombieAttackSystem,
  ) {
    this.targeting = new TargetSelectionSystem(nav, rules);
  }
  update(
    zombies: readonly ZombieEntity[],
    players: readonly PlayerState[],
    now: number,
    tick: number,
    dt: number,
  ) {
    let paths = 0;
    this.navigationMs = 0;
    for (let index = 0; index < zombies.length; index++) {
      const z = zombies[(index + tick) % zombies.length]!;
      if (z.state === ZombieAI.Dead) continue;
      if (z.state === ZombieAI.Windup) {
        this.attacks.resolve(z, players, now, tick);
        continue;
      }
      if (z.state !== ZombieAI.Chasing) {
        if (now < z.stateUntil) continue;
        zombieTransition(z, ZombieAI.Chasing, 0, tick);
        z.progressAt = now;
        Object.assign(z.progressPosition, z.position);
      }
      const target = this.targeting.select(z, players, zombies, now);
      if (!target) {
        z.velocity.x = 0;
        z.velocity.z = 0;
        continue;
      }
      const dx = target.position.x - z.position.x,
        dz = target.position.z - z.position.z;
      z.yaw = Math.atan2(-dx, -dz);
      if (this.attacks.start(z, target, now, tick)) continue;
      const d = ZOMBIES.get(z.archetype),
        dist = Math.hypot(dx, dz);
      let destination: Vec3 | undefined;
      const ranged = this.attacks.kind(z) !== AttackKind.Melee;
      if (
        ranged &&
        lineOfSight(this.physics, chest(z.position), chest(target.position)) &&
        dist < d.preferredRange + 1
      ) {
        if (dist < d.preferredRange - 2) {
          this.desired.x = z.position.x - (dx / (dist || 1)) * 2;
          this.desired.z = z.position.z - (dz / (dist || 1)) * 2;
          this.desired.y = z.position.y;
          if (this.nav.segment(z.position, this.desired, z.radius))
            destination = this.desired;
        }
        if (!destination) {
          z.velocity.x = 0;
          z.velocity.z = 0;
          z.progressAt = now;
          continue;
        }
      } else {
        if (paths < this.rules.pathRequestsPerTick && now >= z.pathAt) {
          const began = performance.now();
          z.path = this.nav.path(z.position, target.position);
          this.navigationMs += performance.now() - began;
          z.cursor = 0;
          z.pathAt = now + this.rules.pathIntervalMs * (dist > 28 ? 2 : 1);
          paths++;
        }
        while (
          z.cursor < z.path.length &&
          horizontalDistance(
            z.position,
            this.nav.nodes[z.path[z.cursor]!]!.position,
          ) < 0.3
        )
          z.cursor++;
        destination = this.nav.nodes[z.path[z.cursor] ?? -1]?.position;
        if (
          dist < 2.5 &&
          this.nav.segment(z.position, target.position, z.radius)
        )
          destination = target.position;
      }
      if (destination) this.move(z, destination, zombies, players, dt);
      else {
        z.velocity.x = 0;
        z.velocity.z = 0;
      }
      if (now - z.progressAt >= this.rules.stuckMs) {
        if (horizontalDistance(z.position, z.progressPosition) < 0.18) {
          z.stuck++;
          this.stuckRecoveries++;
          z.pathAt = 0;
          z.path = [];
          z.targetAt = 0;
          // Back away along a validated local segment; never teleport a stuck enemy.
          this.desired.x =
            z.position.x + Math.sin(z.yaw + (z.stuck % 2 ? 1 : -1));
          this.desired.z =
            z.position.z + Math.cos(z.yaw + (z.stuck % 2 ? 1 : -1));
          this.desired.y = z.position.y;
          this.move(z, this.desired, zombies, players, dt);
        } else z.stuck = 0;
        Object.assign(z.progressPosition, z.position);
        z.progressAt = now;
      }
      z.tick = tick;
    }
  }
  private move(
    z: ZombieEntity,
    target: Vec3,
    zombies: readonly ZombieEntity[],
    players: readonly PlayerState[],
    dt: number,
  ) {
    let dx = target.x - z.position.x,
      dz = target.z - z.position.z,
      length = Math.hypot(dx, dz) || 1;
    dx /= length;
    dz /= length;
    for (const other of zombies) {
      if (other === z || other.health === 0) continue;
      const ox = z.position.x - other.position.x,
        oz = z.position.z - other.position.z,
        dist = Math.hypot(ox, oz);
      const desired = z.radius + other.radius + 0.4;
      if (dist > 0.001 && dist < desired) {
        const force = ((desired - dist) / desired) * 1.4;
        dx += (ox / dist) * force;
        dz += (oz / dist) * force;
      }
    }
    length = Math.hypot(dx, dz) || 1;
    const vx = (dx / length) * z.speed,
      vz = (dz / length) * z.speed,
      accel = ZOMBIES.get(z.archetype).acceleration * dt;
    const difference = Math.hypot(vx - z.velocity.x, vz - z.velocity.z) || 1,
      fraction = Math.min(1, accel / difference);
    z.velocity.x += (vx - z.velocity.x) * fraction;
    z.velocity.z += (vz - z.velocity.z) * fraction;
    this.candidate.x = z.position.x + z.velocity.x * dt;
    this.candidate.z = z.position.z + z.velocity.z * dt;
    this.candidate.y = z.position.y;
    const clear = () =>
      this.nav.segment(z.position, this.candidate, z.radius) &&
      !zombies.some(
        (other) =>
          other !== z &&
          other.health > 0 &&
          horizontalDistance(this.candidate, other.position) <
            z.radius + other.radius + 0.025,
      ) &&
      !players.some(
        (p) =>
          eligiblePlayer(p) &&
          horizontalDistance(this.candidate, p.position) < z.radius + 0.33 &&
          Math.abs(p.position.y - z.position.y) < 1.5,
      );
    if (!clear()) {
      this.candidate.x = z.position.x;
      if (!clear()) {
        this.candidate.x = z.position.x + z.velocity.x * dt;
        this.candidate.z = z.position.z;
      }
      if (!clear()) {
        z.velocity.x = 0;
        z.velocity.z = 0;
        return;
      }
    }
    z.velocity.x = (this.candidate.x - z.position.x) / dt;
    z.velocity.z = (this.candidate.z - z.position.z) / dt;
    z.position.x = this.candidate.x;
    z.position.z = this.candidate.z;
    z.position.y = groundHeight(z.position.x, z.position.z) + 0.04;
  }
}
