import { LIMITS } from "../shared/config";
import { lerpAngle } from "../shared/prediction";
import { ZombieAI, type PvEEvent, type ZombieSnapshot } from "../shared/pve";

export class ZombieTrack {
  id = "";
  revision = 0;
  latest: ZombieSnapshot | null = null;
  readonly history: { time: number; value: ZombieSnapshot }[] = [];
  readonly transform = { x: 0, y: 0, z: 0, yaw: 0 };
  damageUntil = 0;
  telegraphUntil = 0;
  seen = 0;
  corrections = 0;
  reset() {
    this.id = "";
    this.revision = 0;
    this.latest = null;
    this.history.length = 0;
    this.damageUntil = 0;
    this.telegraphUntil = 0;
    this.seen = 0;
    this.corrections = 0;
    Object.assign(this.transform, { x: 0, y: 0, z: 0, yaw: 0 });
  }
  push(value: ZombieSnapshot, time: number) {
    const last = this.history.at(-1);
    if (last && time <= last.time) return;
    if (
      last &&
      Math.hypot(
        value.position.x - last.value.position.x,
        value.position.y - last.value.position.y,
        value.position.z - last.value.position.z,
      ) > LIMITS.hardCorrection
    ) {
      this.history.length = 0;
      this.corrections++;
    }
    this.latest = value;
    this.history.push({ time, value });
    if (this.history.length > 16) this.history.shift();
  }
  sample(now: number) {
    if (!this.latest || !this.history.length) return;
    const renderTime = now - LIMITS.interpolationMs;
    let a = this.history[0]!,
      b = a;
    for (const item of this.history) {
      b = item;
      if (item.time >= renderTime) break;
      a = item;
    }
    const t =
      b.time === a.time
        ? 1
        : Math.max(0, Math.min(1, (renderTime - a.time) / (b.time - a.time)));
    this.transform.x =
      a.value.position.x + (b.value.position.x - a.value.position.x) * t;
    this.transform.y =
      a.value.position.y + (b.value.position.y - a.value.position.y) * t;
    this.transform.z =
      a.value.position.z + (b.value.position.z - a.value.position.z) * t;
    this.transform.yaw = lerpAngle(a.value.yaw, b.value.yaw, t);
    if (renderTime > b.time && this.latest.state === ZombieAI.Chasing) {
      const dt = Math.min(100, renderTime - b.time) / 1000;
      this.transform.x += b.value.velocity.x * dt;
      this.transform.z += b.value.velocity.z * dt;
    }
  }
}
/** Fixed-capacity presentation pool; full snapshot membership is the cleanup authority. */
export class ZombiePresentationStore {
  readonly slots = Array.from({ length: 48 }, () => new ZombieTrack());
  readonly active = new Map<string, ZombieTrack>();
  private lastTick = -1;
  private eventSeq = 0;
  get pooled() {
    return this.slots.length - this.active.size;
  }
  accept(zombies: readonly ZombieSnapshot[], tick: number, time: number) {
    if (tick <= this.lastTick) return false;
    this.lastTick = tick;
    // Release absent/generation-replaced entities before acquiring new render slots.
    for (const [id, slot] of this.active)
      if (!zombies.some((z) => z.id === id && z.revision === slot.revision)) {
        slot.reset();
        this.active.delete(id);
      }
    for (const value of zombies) {
      let slot = this.active.get(value.id);
      if (!slot) {
        slot = this.slots.find((s) => !s.id);
        if (!slot) continue;
        slot.reset();
        slot.id = value.id;
        slot.revision = value.revision;
        this.active.set(value.id, slot);
      }
      slot.seen = tick;
      slot.push(value, time);
    }
    return true;
  }
  event(event: PvEEvent) {
    if (event.seq <= this.eventSeq) return false;
    this.eventSeq = event.seq;
    const slot = this.active.get(event.entityId);
    if (!slot || slot.revision !== event.revision) return true;
    if (event.kind === "zombieDamaged") slot.damageUntil = event.time + 180;
    if (event.kind === "zombieAttackTelegraph")
      slot.telegraphUntil = event.until;
    return true;
  }
  reset(eventSeq = 0) {
    for (const slot of this.slots) slot.reset();
    this.active.clear();
    this.lastTick = -1;
    this.eventSeq = eventSeq;
  }
}
