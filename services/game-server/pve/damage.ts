import {
  resolveWeaponStats,
  type WeaponDefinition,
} from "../../../src/game/shared/phase6";
import { ZombieAI } from "../../../src/game/shared/pve";
import type { Vec3 } from "../../../src/game/shared/protocol";
import { ZOMBIES, type PvERules } from "./definitions";
import {
  zombieTransition,
  type ZombieEntity,
  type ZombieEntityStore,
} from "./entities";
import type { EmitEvent } from "./life";
import type { WaveDirector } from "./waves";

export function rayBox(
  origin: Vec3,
  direction: Vec3,
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  range: number = resolveWeaponStats("ar-01", 0).range,
) {
  let near = 0,
    far: number = range;
  const axes = [
    [origin.x, direction.x, x, hx],
    [origin.y, direction.y, y, hy],
    [origin.z, direction.z, z, hz],
  ];
  for (const [o = 0, d = 0, c = 0, h = 0] of axes) {
    if (Math.abs(d) < 1e-8) {
      if (o < c - h || o > c + h) return Infinity;
      continue;
    }
    const a = (c - h - o) / d,
      b = (c + h - o) / d;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
    if (near > far) return Infinity;
  }
  return near;
}
export class DamageSystem {
  rewindCostMs = 0;
  constructor(
    readonly entities: ZombieEntityStore,
    readonly waves: WaveDirector,
    readonly rules: PvERules,
    readonly emit: EmitEvent,
  ) {}
  hit(
    origin: Vec3,
    direction: Vec3,
    wallDistance: number,
    viewTick: number,
    range = resolveWeaponStats("ar-01", 0).range,
  ) {
    const began = performance.now();
    let nearest = Math.min(wallDistance, range),
      hit: {
        zombie: ZombieEntity;
        region: "head" | "body";
        distance: number;
      } | null = null;
    for (const z of this.entities.entities) {
      if (z.health <= 0 || z.state === ZombieAI.Dead) continue;
      let x = z.position.x,
        y = z.position.y,
        pz = z.position.z,
        bestDelta = Infinity;
      for (let i = 0; i < z.historyCount; i++) {
        const at = i * 4,
          tick = z.history[at]!,
          delta = Math.abs(tick - viewTick);
        if (delta < bestDelta) {
          bestDelta = delta;
          x = z.history[at + 1]!;
          y = z.history[at + 2]!;
          pz = z.history[at + 3]!;
        }
      }
      // Do not rewind an entity before its spawn; old shots cannot hit a later generation.
      const firstTick =
        z.history[((z.historyCursor - z.historyCount + 32) % 32) * 4]!;
      if (viewTick < firstTick) continue;
      const d = ZOMBIES.get(z.archetype),
        headRadius = d.height * 0.125;
      const head = rayBox(
        origin,
        direction,
        x,
        y + d.height * 0.875,
        pz,
        headRadius,
        headRadius,
        headRadius,
        range,
      );
      const body = rayBox(
        origin,
        direction,
        x,
        y + d.height * 0.4,
        pz,
        d.radius,
        d.height * 0.35,
        d.radius,
        range,
      );
      const region = head <= body ? "head" : "body",
        distance = Math.min(head, body);
      if (distance < nearest) {
        nearest = distance;
        hit = { zombie: z, region, distance };
      }
    }
    this.rewindCostMs = performance.now() - began;
    return hit;
  }
  apply(
    z: ZombieEntity,
    region: "head" | "body",
    now: number,
    tick: number,
    stats: Pick<
      WeaponDefinition,
      "baseDamage" | "headshotMultiplier"
    > = resolveWeaponStats("ar-01", 0),
    playerId = "",
  ) {
    if (z.health <= 0 || z.state === ZombieAI.Dead) return false;
    const amount = Math.min(
      z.health,
      Math.ceil(
        stats.baseDamage *
          (region === "head"
            ? stats.headshotMultiplier
            : this.rules.bodyMultiplier),
      ),
    );
    z.health = Math.max(0, z.health - amount);
    z.tick = tick;
    this.emit("zombieDamaged", {
      playerId,
      entityId: z.id,
      revision: z.revision,
      position: { ...z.position },
      amount,
      detail: region,
    });
    if (z.health === 0) {
      zombieTransition(z, ZombieAI.Dead, now + this.rules.despawnMs, tick);
      z.targetId = "";
      z.attackTargetId = "";
      this.waves.defeated();
      this.emit("zombieDied", {
        playerId,
        entityId: z.id,
        revision: z.revision,
        position: { ...z.position },
        detail: z.archetype,
      });
    } else {
      const d = ZOMBIES.get(z.archetype);
      if (
        d.staggerMs > 0 &&
        amount >= d.staggerDamage &&
        z.state !== ZombieAI.Staggered
      )
        zombieTransition(z, ZombieAI.Staggered, now + d.staggerMs, tick);
    }
    return true;
  }
}
