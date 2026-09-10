import { ZOMBIE_SPAWN_ZONES } from "../../../src/game/shared/arena";
import type { ArenaPhysics } from "../../../src/game/shared/physics";
import type { PlayerState, Vec3 } from "../../../src/game/shared/protocol";
import type { PvERules } from "./definitions";
import {
  horizontalDistance,
  lineOfSight,
  NavigationSystem,
  navigable,
  groundHeight,
} from "./navigation";

export function seededRandom(seed: number) {
  let value = seed >>> 0;
  return () => {
    value += 0x6d2b79f5;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export interface Occupant {
  position: Vec3;
  radius: number;
}
export class SpawnDirector {
  readonly candidates: Vec3[];
  failures = 0;
  consecutiveFailures = 0;
  attempts = 0;
  private used = new Map<number, number>();
  constructor(
    readonly navigation: NavigationSystem,
    readonly physics: ArenaPhysics,
    readonly rules: PvERules,
    readonly random: () => number,
  ) {
    this.candidates = navigation.nodes
      .filter((n) =>
        ZOMBIE_SPAWN_ZONES.some(
          (zone) =>
            n.position.x >= zone.minX &&
            n.position.x <= zone.maxX &&
            n.position.z >= zone.minZ &&
            n.position.z <= zone.maxZ,
        ),
      )
      .map((n) => n.position);
    if (!this.candidates.length)
      throw new Error("No navigation-valid spawn zones");
  }
  valid(
    position: Vec3,
    radius: number,
    players: readonly PlayerState[],
    zombies: readonly Occupant[],
  ) {
    if (
      !Number.isFinite(position.y) ||
      Math.abs(position.y - groundHeight(position.x, position.z) - 0.04) >
        0.05 ||
      !navigable(position.x, position.z, radius) ||
      !this.physics.validSpawn(position) ||
      !ZOMBIE_SPAWN_ZONES.some(
        (z) =>
          position.x >= z.minX &&
          position.x <= z.maxX &&
          position.z >= z.minZ &&
          position.z <= z.maxZ,
      )
    )
      return false;
    let reachable = false;
    for (const p of players) {
      // Retained player positions also exclude unfair near-spawns during reconnect/downing.
      const d = horizontalDistance(position, p.position);
      if (d < this.rules.minSpawnDistance) return false;
      if (
        p.connected &&
        p.ready &&
        p.life === "ALIVE" &&
        d <= this.rules.maxSpawnDistance &&
        this.navigation.reachable(position, p.position)
      )
        reachable = true;
    }
    return (
      reachable &&
      !zombies.some(
        (z) =>
          horizontalDistance(position, z.position) < radius + z.radius + 0.15,
      )
    );
  }
  score(position: Vec3, players: readonly PlayerState[]) {
    let visible = 0,
      nearest = Infinity;
    for (const p of players) {
      if (!p.connected || p.life !== "ALIVE") continue;
      const d = horizontalDistance(position, p.position);
      nearest = Math.min(nearest, d);
      const dx = (position.x - p.position.x) / (d || 1),
        dz = (position.z - p.position.z) / (d || 1);
      if (
        dx * -Math.sin(p.yaw) + dz * -Math.cos(p.yaw) > 0.2 &&
        lineOfSight(
          this.physics,
          { ...p.position, y: p.position.y + 1.6 },
          { ...position, y: position.y + 1 },
        )
      )
        visible++;
    }
    return Math.min(28, nearest) - visible * 40;
  }
  select(
    radius: number,
    players: readonly PlayerState[],
    zombies: readonly Occupant[],
    now: number,
  ) {
    let winner = -1,
      best = -Infinity;
    this.attempts = 0;
    const start = Math.floor(this.random() * this.candidates.length);
    // Distinct candidates, bounded regardless of geometry or player positions.
    const stride = Math.max(
      1,
      Math.floor(this.candidates.length / this.rules.spawnAttempts),
    );
    for (
      let i = 0;
      i < Math.min(this.rules.spawnAttempts, this.candidates.length);
      i++
    ) {
      this.attempts++;
      const index = (start + i * stride) % this.candidates.length,
        p = this.candidates[index]!;
      if (!this.valid(p, radius, players, zombies)) continue;
      const score =
        this.score(p, players) -
        (now - (this.used.get(index) ?? -60000) < 15000 ? 35 : 0);
      if (score > best) {
        winner = index;
        best = score;
      }
    }
    if (winner < 0) {
      this.failures++;
      this.consecutiveFailures++;
      return null;
    }
    this.consecutiveFailures = 0;
    this.used.set(winner, now);
    return { ...this.candidates[winner]! };
  }
}
