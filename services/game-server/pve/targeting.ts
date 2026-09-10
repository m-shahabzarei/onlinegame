import type { PlayerState } from "../../../src/game/shared/protocol";
import type { PvERules } from "./definitions";
import type { ZombieEntity } from "./entities";
import { horizontalDistance, NavigationSystem } from "./navigation";

export const eligiblePlayer = (p: PlayerState) =>
  p.connected &&
  p.ready &&
  p.life === "ALIVE" &&
  Number.isFinite(p.position.x) &&
  Number.isFinite(p.position.y) &&
  Number.isFinite(p.position.z) &&
  Math.abs(p.position.x) < 16 &&
  Math.abs(p.position.z) < 20 &&
  p.position.y >= -0.1 &&
  p.position.y < 8;
export class TargetSelectionSystem {
  constructor(
    readonly nav: NavigationSystem,
    readonly rules: PvERules,
  ) {}
  select(
    z: ZombieEntity,
    players: readonly PlayerState[],
    zombies: readonly ZombieEntity[],
    now: number,
  ) {
    let current = players.find((p) => p.id === z.targetId);
    if (
      current &&
      (!eligiblePlayer(current) ||
        !this.nav.reachable(z.position, current.position))
    ) {
      z.targetId = "";
      current = undefined;
      z.targetAt = 0;
    }
    if (now < z.targetAt) return current;
    z.targetAt = now + this.rules.targetIntervalMs;
    let best: PlayerState | undefined,
      bestScore = Infinity;
    for (const p of players) {
      if (!eligiblePlayer(p) || !this.nav.reachable(z.position, p.position))
        continue;
      let assigned = 0;
      for (const other of zombies)
        if (other !== z && other.health > 0 && other.targetId === p.id)
          assigned++;
      const score =
        horizontalDistance(z.position, p.position) + assigned * 0.45;
      if (score < bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (
      current &&
      best &&
      best.id !== current.id &&
      bestScore >=
        horizontalDistance(z.position, current.position) *
          this.rules.targetHysteresis
    )
      return current;
    if (z.targetId !== (best?.id ?? "")) {
      z.pathAt = 0;
      z.path = [];
    }
    z.targetId = best?.id ?? "";
    return best;
  }
}
