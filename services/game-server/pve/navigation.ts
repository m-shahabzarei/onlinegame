import {
  ARENA_BOXES,
  NAVIGATION,
  TARGETS,
} from "../../../src/game/shared/arena";
import type { ArenaPhysics } from "../../../src/game/shared/physics";
import type { Vec3 } from "../../../src/game/shared/protocol";

export const horizontalDistance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.z - b.z);
export function lineOfSight(physics: ArenaPhysics, a: Vec3, b: Vec3) {
  const length = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
  if (length < 0.01) return true;
  const impact = physics.raycast(
    a,
    {
      x: (b.x - a.x) / length,
      y: (b.y - a.y) / length,
      z: (b.z - a.z) / length,
    },
    () => true,
  );
  return (
    Math.hypot(
      impact.point.x - a.x,
      impact.point.y - a.y,
      impact.point.z - a.z,
    ) >=
    length - 0.04
  );
}
/** Ground and existing ramp/catwalk are derived from the same simplified map boxes. */
export function groundHeight(x: number, z: number) {
  let height = 0;
  for (const box of ARENA_BOXES) {
    if (!NAVIGATION.walkableSurfaces.includes(box.id)) continue;
    if (Math.abs(x - box.position.x) > box.half.x - 0.05) continue;
    const angle = box.rotationX ?? 0;
    const extent = box.half.z * Math.cos(angle) + box.half.y * Math.sin(angle);
    if (Math.abs(z - box.position.z) > extent) continue;
    height = Math.max(
      height,
      box.position.y +
        box.half.y / Math.cos(angle) -
        Math.tan(angle) * (z - box.position.z),
    );
  }
  return height;
}
export function navigable(
  x: number,
  z: number,
  radius: number = NAVIGATION.clearance,
) {
  if (
    !Number.isFinite(x) ||
    !Number.isFinite(z) ||
    Math.abs(x) > 15.6 - radius ||
    Math.abs(z) > 19.6 - radius
  )
    return false;
  const y = groundHeight(x, z);
  // Training plates remain physical obstacles even during their target reset.
  for (const plate of TARGETS) {
    if (
      Math.abs(x - plate.position.x) < plate.half.x + radius &&
      Math.abs(z - plate.position.z) < plate.half.z + radius &&
      plate.position.y + plate.half.y > y &&
      plate.position.y - plate.half.y < y + NAVIGATION.height
    )
      return false;
  }
  for (const box of ARENA_BOXES) {
    if (box.id === "floor") continue;
    if (
      Math.abs(x - box.position.x) >= box.half.x + radius ||
      Math.abs(z - box.position.z) >= box.half.z + radius
    )
      continue;
    if (
      NAVIGATION.walkableSurfaces.includes(box.id) &&
      y >= groundHeight(box.position.x, z) - 0.05
    )
      continue;
    if (
      box.position.y + box.half.y <= y + 0.05 ||
      box.position.y - box.half.y >= y + NAVIGATION.height
    )
      continue;
    return false;
  }
  return true;
}
interface Node {
  position: Vec3;
  neighbors: number[];
  component: number;
}
/** Bounded A*: <=1209 nodes, fixed reusable search arrays, at most two searches/tick. */
export class NavigationSystem {
  readonly nodes: Node[] = [];
  private grid = new Map<string, number>();
  private costs: Float64Array;
  private parents: Int32Array;
  private closed: Uint8Array;
  private open: number[] = [];
  private cache = new Map<string, readonly number[]>();
  requests = 0;
  failed = 0;
  constructor() {
    for (let z = NAVIGATION.minZ; z <= NAVIGATION.maxZ; z++)
      for (let x = NAVIGATION.minX; x <= NAVIGATION.maxX; x++) {
        if (!navigable(x, z)) continue;
        this.grid.set(`${x},${z}`, this.nodes.length);
        this.nodes.push({
          position: { x, y: groundHeight(x, z) + 0.04, z },
          neighbors: [],
          component: -1,
        });
      }
    for (const n of this.nodes)
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const) {
        const j = this.grid.get(`${n.position.x + dx},${n.position.z + dz}`);
        if (
          j !== undefined &&
          this.segment(n.position, this.nodes[j]!.position)
        )
          n.neighbors.push(j);
      }
    let component = 0;
    for (let i = 0; i < this.nodes.length; i++) {
      if (this.nodes[i]!.component !== -1) continue;
      const pending = [i];
      this.nodes[i]!.component = component;
      while (pending.length)
        for (const j of this.nodes[pending.pop()!]!.neighbors) {
          if (this.nodes[j]!.component !== -1) continue;
          this.nodes[j]!.component = component;
          pending.push(j);
        }
      component++;
    }
    this.costs = new Float64Array(this.nodes.length);
    this.parents = new Int32Array(this.nodes.length);
    this.closed = new Uint8Array(this.nodes.length);
  }
  nearest(position: Vec3, maxDistance = 3) {
    let best = -1,
      distance = maxDistance;
    for (
      let z = Math.ceil(position.z - maxDistance);
      z <= Math.floor(position.z + maxDistance);
      z++
    )
      for (
        let x = Math.ceil(position.x - maxDistance);
        x <= Math.floor(position.x + maxDistance);
        x++
      ) {
        const i = this.grid.get(`${x},${z}`);
        if (i === undefined) continue;
        const p = this.nodes[i]!.position,
          d = Math.hypot(
            x - position.x,
            z - position.z,
            (p.y - position.y) * 0.5,
          );
        if (d < distance) {
          best = i;
          distance = d;
        }
      }
    return best;
  }
  reachable(a: Vec3, b: Vec3) {
    const start = this.nearest(a),
      end = this.nearest(b);
    return (
      start !== -1 &&
      end !== -1 &&
      this.nodes[start]!.component === this.nodes[end]!.component
    );
  }
  segment(a: Vec3, b: Vec3, radius: number = NAVIGATION.clearance) {
    const count = Math.max(1, Math.ceil(horizontalDistance(a, b) / 0.2));
    let lastY = groundHeight(a.x, a.z);
    for (let i = 1; i <= count; i++) {
      const x = a.x + ((b.x - a.x) * i) / count,
        z = a.z + ((b.z - a.z) * i) / count,
        y = groundHeight(x, z);
      if (!navigable(x, z, radius) || Math.abs(y - lastY) > NAVIGATION.maxStep)
        return false;
      lastY = y;
    }
    return true;
  }
  path(a: Vec3, b: Vec3): readonly number[] {
    this.requests++;
    const start = this.nearest(a),
      end = this.nearest(b);
    if (
      start === -1 ||
      end === -1 ||
      this.nodes[start]!.component !== this.nodes[end]!.component
    ) {
      this.failed++;
      return [];
    }
    const key = `${start}:${end}`,
      cached = this.cache.get(key);
    if (cached) return cached;
    this.costs.fill(Infinity);
    this.parents.fill(-1);
    this.closed.fill(0);
    this.open.length = 0;
    this.open.push(start);
    this.costs[start] = 0;
    let expanded = 0,
      found = false;
    const target = this.nodes[end]!.position;
    while (this.open.length && expanded++ < this.nodes.length) {
      let best = 0,
        score = Infinity;
      for (let i = 0; i < this.open.length; i++) {
        const index = this.open[i]!,
          p = this.nodes[index]!.position;
        const f =
          this.costs[index]! +
          Math.abs(p.x - target.x) +
          Math.abs(p.z - target.z);
        if (f < score) {
          score = f;
          best = i;
        }
      }
      const current = this.open[best]!;
      this.open[best] = this.open[this.open.length - 1]!;
      this.open.pop();
      if (current === end) {
        found = true;
        break;
      }
      this.closed[current] = 1;
      for (const next of this.nodes[current]!.neighbors) {
        if (this.closed[next]) continue;
        const cost = this.costs[current]! + 1;
        if (cost >= this.costs[next]!) continue;
        if (!Number.isFinite(this.costs[next])) this.open.push(next);
        this.costs[next] = cost;
        this.parents[next] = current;
      }
    }
    if (!found) {
      this.failed++;
      return [];
    }
    const path: number[] = [];
    for (let cursor = end; cursor !== -1; cursor = this.parents[cursor]!)
      path.push(cursor);
    path.reverse();
    if (this.cache.size >= 128)
      this.cache.delete(this.cache.keys().next().value!);
    this.cache.set(key, path);
    return path;
  }
  dispose() {
    this.cache.clear();
    this.open.length = 0;
  }
}
