import { LIMITS } from "./config";
import type {
  MotionState,
  PlayerInput,
  PlayerState,
  Vec3,
  WorldSnapshot,
} from "./protocol";
import type { ArenaPhysics } from "./physics";
export const distance = (a: Vec3, b: Vec3) =>
  Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function copyMotion(target: MotionState, source: MotionState) {
  Object.assign(target.position, source.position);
  Object.assign(target.velocity, source.velocity);
  target.yaw = source.yaw;
  target.pitch = source.pitch;
  target.grounded = source.grounded;
  target.crouched = source.crouched;
  target.sprinting = source.sprinting;
}
export class PredictionBuffer {
  readonly pending: PlayerInput[] = [];
  error = 0;
  corrections = 0;
  maxCorrection = 0;
  lastAck = 0;
  readonly visualOffset: Vec3 = { x: 0, y: 0, z: 0 };
  push(input: PlayerInput) {
    if (this.pending.length >= LIMITS.inputHistory) return false;
    this.pending.push(input);
    return true;
  }
  acknowledge(seq: number) {
    if (seq < this.lastAck) return false;
    this.lastAck = seq;
    let n = 0;
    while (n < this.pending.length && this.pending[n]!.seq <= seq) n++;
    this.pending.splice(0, n);
    return true;
  }
  reconcile(
    local: MotionState,
    authority: PlayerState,
    physics: Pick<ArenaPhysics, "step">,
  ) {
    if (!this.acknowledge(authority.lastInput)) return;
    const x = local.position.x,
      y = local.position.y,
      z = local.position.z;
    copyMotion(local, authority);
    for (const input of this.pending) physics.step(authority.id, local, input);
    this.error = Math.hypot(
      x - local.position.x,
      y - local.position.y,
      z - local.position.z,
    );
    if (this.error > 0.015) {
      this.corrections++;
      this.maxCorrection = Math.max(this.maxCorrection, this.error);
    }
    const smooth = this.error < LIMITS.hardCorrection;
    this.visualOffset.x = smooth
      ? Math.max(-1, Math.min(1, this.visualOffset.x + x - local.position.x))
      : 0;
    this.visualOffset.y = smooth
      ? Math.max(-1, Math.min(1, this.visualOffset.y + y - local.position.y))
      : 0;
    this.visualOffset.z = smooth
      ? Math.max(-1, Math.min(1, this.visualOffset.z + z - local.position.z))
      : 0;
  }
  smooth(delta: number) {
    const f = Math.exp(-delta / LIMITS.smoothingSeconds);
    this.visualOffset.x *= f;
    this.visualOffset.y *= f;
    this.visualOffset.z *= f;
  }
  reset(seq = 0) {
    this.pending.length = 0;
    this.lastAck = seq;
    Object.assign(this.visualOffset, { x: 0, y: 0, z: 0 });
  }
}
export function lerpAngle(a: number, b: number, t: number) {
  return a + Math.atan2(Math.sin(b - a), Math.cos(b - a)) * t;
}
export class SnapshotBuffer {
  readonly items: WorldSnapshot[] = [];
  push(snapshot: WorldSnapshot) {
    if (
      this.items.at(-1)?.tick !== undefined &&
      snapshot.tick <= this.items.at(-1)!.tick
    )
      return;
    this.items.push(snapshot);
    if (this.items.length > LIMITS.snapshots) this.items.shift();
  }
  reset() {
    this.items.length = 0;
  }
  sample(
    playerId: string,
    time: number,
    out: MotionState,
  ): PlayerState | undefined {
    if (!this.items.length) return;
    const renderTime = time - LIMITS.interpolationMs;
    let a = this.items[0]!,
      b = a;
    for (const s of this.items) {
      b = s;
      if (s.time >= renderTime) break;
      a = s;
    }
    const pa = a.players.find((p) => p.id === playerId),
      pb = b.players.find((p) => p.id === playerId);
    if (!pa || !pb) return;
    copyMotion(out, pb);
    if (distance(pa.position, pb.position) > LIMITS.hardCorrection) return pb;
    const t =
      b.time === a.time
        ? 1
        : Math.max(0, Math.min(1, (renderTime - a.time) / (b.time - a.time)));
    for (const axis of ["x", "y", "z"] as const)
      out.position[axis] =
        pa.position[axis] + (pb.position[axis] - pa.position[axis]) * t;
    out.yaw = lerpAngle(pa.yaw, pb.yaw, t);
    out.pitch = pa.pitch + (pb.pitch - pa.pitch) * t;
    if (renderTime > b.time && pb.connected) {
      const seconds =
        Math.min(LIMITS.extrapolationMs, renderTime - b.time) / 1000;
      out.position.x += pb.velocity.x * seconds;
      out.position.z += pb.velocity.z * seconds;
    }
    return pb;
  }
}
