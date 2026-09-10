import { RIFLE } from "./config";
import { GameError, type Vec3, type WeaponState } from "./protocol";
export const newWeapon = (): WeaponState => ({
  magazine: RIFLE.magazine,
  reserve: RIFLE.reserve,
  reloadAt: 0,
  nextFireAt: 0,
  lastShot: 0,
  lastReload: 0,
});
/** Firing never cancels a reload. Duplicate command sequences never repeat an effect. */
export function fireWeapon(w: WeaponState, seq: number, now: number) {
  if (seq <= w.lastShot || seq > w.lastShot + 128)
    throw new GameError("SHOT_SEQUENCE");
  w.lastShot = seq;
  if (w.reloadAt) throw new GameError("RELOADING");
  if (now < w.nextFireAt) throw new GameError("FIRE_RATE");
  if (w.magazine === 0) throw new GameError("EMPTY");
  w.magazine--;
  w.nextFireAt = now + RIFLE.fireIntervalMs;
}
export function reloadWeapon(w: WeaponState, seq: number, now: number) {
  if (seq <= w.lastReload) return false;
  if (seq > w.lastReload + 128) throw new GameError("INVALID_RELOAD");
  w.lastReload = seq;
  if (w.reloadAt) return false;
  if (w.magazine === RIFLE.magazine || w.reserve === 0)
    throw new GameError("INVALID_RELOAD");
  w.reloadAt = now + RIFLE.reloadMs;
  return true;
}
export function completeReload(w: WeaponState, now: number) {
  if (!w.reloadAt || now < w.reloadAt) return false;
  const count = Math.min(RIFLE.magazine - w.magazine, w.reserve);
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
): Vec3 {
  const spread = RIFLE.baseSpread + (moving ? RIFLE.movementSpread : 0);
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
