import type { Vec3 } from "./protocol";
export interface MapBox {
  id: string;
  position: Vec3;
  half: Vec3;
  rotationX?: number;
  material: "concrete" | "steel" | "crate" | "blue" | "red";
}
const box = (
  id: string,
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  material: MapBox["material"] = "concrete",
): MapBox => ({
  id,
  position: { x, y, z },
  half: { x: hx, y: hy, z: hz },
  material,
});
/** Physics geometry in metres. Render decoration is defined separately by the client. */
export const ARENA_BOXES: readonly MapBox[] = [
  box("floor", 0, -0.5, 0, 16, 0.5, 20),
  box("west", -16, 3, 0, 0.4, 3, 20),
  box("east", 16, 3, 0, 0.4, 3, 20),
  box("north", 0, 3, -20, 16, 3, 0.4),
  box("south", 0, 3, 20, 16, 3, 0.4),
  box("cover-a", -5, 0.7, 2, 1.5, 0.7, 1.2, "crate"),
  box("cover-b", 5, 1.1, -3, 1.2, 1.1, 1.2, "crate"),
  box("occlusion-wall", 0, 2, -7, 2.5, 2, 0.35, "steel"),
  box("catwalk", -11, 1, -5, 2.5, 1, 4, "steel"),
  {
    ...box("ramp", -11, 0.8, 1.5, 2.5, 0.2, 3, "steel"),
    rotationX: Math.atan(1 / 3),
  },
  box("crouch-beam", 8, 1.6, 8, 2, 0.2, 1, "steel"),
];
export const SPAWNS: readonly Vec3[] = [
  { x: -3, y: 0.04, z: 14 },
  { x: 3, y: 0.04, z: 14 },
];
export const FALLBACK_SPAWN = { x: 0, y: 0.04, z: 16 };
export const TARGETS = [
  {
    id: "plate-a",
    position: { x: -7, y: 1.65, z: -16 },
    half: { x: 0.65, y: 0.85, z: 0.15 },
  },
  {
    id: "plate-b",
    position: { x: 7, y: 1.65, z: -16 },
    half: { x: 0.65, y: 0.85, z: 0.15 },
  },
  {
    id: "plate-occluded",
    position: { x: 0, y: 1.65, z: -12 },
    half: { x: 0.65, y: 0.85, z: 0.15 },
  },
] as const;
export const TARGET_HEALTH = 100;
export const TARGET_RESET_MS = 5000;

/** Versioned simplified navigation inputs; clients never build authoritative paths. */
export const NAVIGATION = Object.freeze({
  cellSize: 1,
  clearance: 0.62,
  height: 2.45,
  maxStep: 0.48,
  minX: -15,
  maxX: 15,
  minZ: -19,
  maxZ: 19,
  walkableSurfaces: ["catwalk", "ramp"] as readonly string[],
});
export const ZOMBIE_SPAWN_ZONES = [
  { id: "north-west", minX: -14, maxX: -4, minZ: -18, maxZ: -15 },
  { id: "north-east", minX: 4, maxX: 14, minZ: -18, maxZ: -14 },
  { id: "east", minX: 12, maxX: 14, minZ: -10, maxZ: 16 },
  { id: "west", minX: -14, maxX: -13, minZ: 6, maxZ: 17 },
  { id: "south", minX: -12, maxX: 12, minZ: 17, maxZ: 18 },
] as const;
