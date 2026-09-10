import {
  ZombieAI,
  type Archetype,
  type ZombieSnapshot,
} from "../../../src/game/shared/pve";
import type { Vec3 } from "../../../src/game/shared/protocol";
import { AttackKind, ZOMBIES } from "./definitions";
import { DifficultySystem, type WaveConfig } from "./waves";

export interface ZombieEntity extends ZombieSnapshot {
  radius: number;
  damage: number;
  speed: number;
  targetId: string;
  path: readonly number[];
  cursor: number;
  pathAt: number;
  targetAt: number;
  cooldownAt: number;
  attackTargetId: string;
  attackPoint: Vec3;
  attackKind: AttackKind;
  calls: number;
  progressAt: number;
  progressPosition: Vec3;
  stuck: number;
  history: Float64Array;
  historyCursor: number;
  historyCount: number;
}
const allowed: Record<ZombieAI, readonly ZombieAI[]> = {
  [ZombieAI.Spawning]: [ZombieAI.Chasing, ZombieAI.Staggered, ZombieAI.Dead],
  [ZombieAI.Chasing]: [ZombieAI.Windup, ZombieAI.Staggered, ZombieAI.Dead],
  [ZombieAI.Windup]: [ZombieAI.Recovery, ZombieAI.Staggered, ZombieAI.Dead],
  [ZombieAI.Recovery]: [ZombieAI.Chasing, ZombieAI.Staggered, ZombieAI.Dead],
  [ZombieAI.Staggered]: [ZombieAI.Chasing, ZombieAI.Dead],
  [ZombieAI.Dead]: [],
};
export function zombieTransition(
  z: ZombieEntity,
  state: ZombieAI,
  until: number,
  tick: number,
) {
  if (z.state === state) return false;
  if (!allowed[z.state].includes(state))
    throw new Error(`Invalid zombie transition ${z.state} -> ${state}`);
  z.state = state;
  z.stateUntil = until;
  z.tick = tick;
  if (state !== ZombieAI.Chasing) {
    z.velocity.x = 0;
    z.velocity.z = 0;
  }
  return true;
}
/** Monotonic IDs plus pool generation protect against stale references across reuse. */
export class ZombieEntityStore {
  readonly entities: ZombieEntity[] = [];
  private pool: ZombieEntity[] = [];
  private nextId = 0;
  get alive() {
    let n = 0;
    for (const z of this.entities) if (z.state !== ZombieAI.Dead) n++;
    return n;
  }
  get(id: string) {
    return this.entities.find((z) => z.id === id);
  }
  spawn(
    archetype: Archetype,
    position: Vec3,
    wave: WaveConfig,
    now: number,
    tick: number,
  ) {
    if (this.entities.length >= 48)
      throw new Error("Zombie entity storage limit");
    const old = this.pool.pop(),
      d = ZOMBIES.get(archetype),
      stats = DifficultySystem.stats(archetype, wave);
    const revision = (old?.revision ?? 0) + 1;
    const z: ZombieEntity = Object.assign(old ?? {}, {
      id: `z${++this.nextId}`,
      revision,
      archetype,
      position: { ...position },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      health: stats.health,
      maxHealth: stats.health,
      state: ZombieAI.Spawning,
      stateUntil: now + 600,
      spawnAt: now,
      tick,
      radius: d.radius,
      damage: stats.damage,
      speed: stats.speed,
      targetId: "",
      path: [],
      cursor: 0,
      pathAt: now + (this.nextId % 12) * 33,
      targetAt: now + (this.nextId % 6) * 33,
      cooldownAt: now + 1000,
      attackTargetId: "",
      attackPoint: { x: 0, y: 0, z: 0 },
      attackKind: d.attack,
      calls: 0,
      progressAt: now,
      progressPosition: { ...position },
      stuck: 0,
      history: old?.history ?? new Float64Array(32 * 4),
      historyCursor: 0,
      historyCount: 0,
    });
    z.history.fill(0);
    this.entities.push(z);
    this.record(z, tick);
    return z;
  }
  record(z: ZombieEntity, tick: number) {
    const at = z.historyCursor * 4;
    z.history[at] = tick;
    z.history[at + 1] = z.position.x;
    z.history[at + 2] = z.position.y;
    z.history[at + 3] = z.position.z;
    z.historyCursor = (z.historyCursor + 1) % 32;
    z.historyCount = Math.min(32, z.historyCount + 1);
  }
  remove(z: ZombieEntity) {
    const at = this.entities.indexOf(z);
    if (at < 0) return;
    this.entities.splice(at, 1);
    z.id = "";
    z.targetId = "";
    z.attackTargetId = "";
    z.path = [];
    z.historyCount = 0;
    z.health = 0;
    z.velocity.x = 0;
    z.velocity.y = 0;
    z.velocity.z = 0;
    this.pool.push(z);
  }
  dispose() {
    this.entities.length = 0;
    this.pool.length = 0;
  }
}
