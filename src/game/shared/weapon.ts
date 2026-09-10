import { resolveWeaponStats, type WeaponDefinition } from "./phase6";
import { GameError, type Vec3, type WeaponState } from "./protocol";
export type CombatStats = Pick<
  WeaponDefinition,
  | "magazineCapacity"
  | "reserveCapacity"
  | "fireIntervalMs"
  | "reloadMs"
  | "spread"
  | "movementAccuracy"
>;
const defaultStats = resolveWeaponStats("ar-01", 0);
export const newWeapon = (stats: CombatStats = defaultStats): WeaponState => ({
  magazine: stats.magazineCapacity,
  reserve: stats.reserveCapacity,
  reloadAt: 0,
  nextFireAt: 0,
  lastShot: 0,
  lastReload: 0,
});
/** Firing never cancels a reload. Duplicate command sequences never repeat an effect. */
export function fireWeapon(
  w: WeaponState,
  seq: number,
  now: number,
  stats: CombatStats = defaultStats,
) {
  if (seq <= w.lastShot || seq > w.lastShot + 128)
    throw new GameError("SHOT_SEQUENCE");
  w.lastShot = seq;
  if (w.reloadAt) throw new GameError("RELOADING");
  if (now < w.nextFireAt) throw new GameError("FIRE_RATE");
  if (w.magazine === 0) throw new GameError("EMPTY");
  w.magazine--;
  w.nextFireAt = now + stats.fireIntervalMs;
}
export function reloadWeapon(
  w: WeaponState,
  seq: number,
  now: number,
  stats: CombatStats = defaultStats,
) {
  if (seq <= w.lastReload) return false;
  if (seq > w.lastReload + 128) throw new GameError("INVALID_RELOAD");
  w.lastReload = seq;
  if (w.reloadAt) return false;
  if (w.magazine >= stats.magazineCapacity || w.reserve === 0)
    throw new GameError("INVALID_RELOAD");
  w.reloadAt = now + stats.reloadMs;
  return true;
}
export function completeReload(
  w: WeaponState,
  now: number,
  stats: CombatStats = defaultStats,
) {
  if (!w.reloadAt || now < w.reloadAt) return false;
  const count = Math.min(
    Math.max(0, stats.magazineCapacity - w.magazine),
    w.reserve,
  );
  w.magazine += count;
  w.reserve -= count;
  w.reloadAt = 0;
  return true;
}
/** Server generates spread; clients never supply a ray origin, hit or damage value. */
export function shotDirection(
  yaw: number,
  pitch: number,
  moving: boolean,
  random: () => number,
  stats: CombatStats = defaultStats,
): Vec3 {
  const spread = stats.spread + (moving ? stats.movementAccuracy : 0);
  yaw += (random() * 2 - 1) * spread;
  pitch += (random() * 2 - 1) * spread;
  return {
    x: -Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: -Math.cos(yaw) * Math.cos(pitch),
  };
}
export const canDamage = (kind: "player" | "trainingTarget") =>
  kind === "trainingTarget";
