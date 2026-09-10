import * as THREE from "three";
import { ZombieAI, type Archetype } from "../shared/pve";
import { ZombiePresentationStore } from "./zombie-buffer";

/** Original procedural stand-ins. Shared geometry/materials; no downloaded assets. */
const appearance: Record<
  Archetype,
  { color: number; height: number; radius: number; label: string }
> = {
  walker: { color: 0x819889, height: 1.8, radius: 0.34, label: "WALKER" },
  runner: { color: 0xbab58d, height: 1.65, radius: 0.3, label: "RUNNER" },
  spitter: { color: 0x8dbaae, height: 1.75, radius: 0.34, label: "SPITTER" },
  brute: { color: 0xa79489, height: 2.4, radius: 0.58, label: "BRUTE" },
  screamer: { color: 0xb297b8, height: 1.9, radius: 0.34, label: "SCREAMER" },
};
interface RenderSlot {
  group: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Mesh;
  arms: THREE.Mesh[];
  legs: THREE.Mesh[];
  ring: THREE.Mesh;
  crest: THREE.Mesh;
  label: THREE.Sprite;
  color: THREE.Color;
  id: string;
  revision: number;
}
export class ZombieRenderer {
  readonly store = new ZombiePresentationStore();
  private readonly group = new THREE.Group();
  private readonly slots: RenderSlot[] = [];
  private readonly box = new THREE.BoxGeometry(1, 1, 1);
  private readonly sphere = new THREE.SphereGeometry(1, 8, 6);
  private readonly ring = new THREE.RingGeometry(0.7, 0.76, 20);
  private readonly warning = new THREE.MeshBasicMaterial({
    color: 0xf2b86b,
    side: THREE.DoubleSide,
  });
  private readonly material = new THREE.MeshStandardMaterial({
    roughness: 0.95,
  });
  private readonly bodies = new THREE.InstancedMesh(
    this.box,
    this.material,
    48 * 5,
  );
  private readonly heads = new THREE.InstancedMesh(
    this.sphere,
    this.material,
    48,
  );
  private readonly rings = new THREE.InstancedMesh(this.ring, this.warning, 48);
  private readonly crests = new THREE.InstancedMesh(this.box, this.warning, 48);
  private readonly batches = [this.bodies, this.heads, this.rings, this.crests];
  private readonly hidden = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly hitColor = new THREE.Color(0xbbae91);
  private readonly labels = new Map<Archetype, THREE.SpriteMaterial>();
  constructor(scene: THREE.Scene) {
    scene.add(this.group);
    // Fixed instance indices belong to presentation slots. Each rigid limb still
    // has its own animated transform; no client hit or entity identity uses a draw call.
    for (const batch of this.batches) {
      batch.frustumCulled = false;
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let i = 0; i < batch.count; i++) batch.setMatrixAt(i, this.hidden);
      this.group.add(batch);
    }
    for (const [id, data] of Object.entries(appearance) as [
      Archetype,
      (typeof appearance)[Archetype],
    ][]) {
      const canvas = document.createElement("canvas");
      canvas.width = 256;
      canvas.height = 48;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#17222f";
      ctx.fillRect(0, 0, 256, 48);
      ctx.fillStyle = "#f1f3ff";
      ctx.font = "bold 25px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(data.label, 128, 32);
      const texture = new THREE.CanvasTexture(canvas);
      this.labels.set(
        id,
        new THREE.SpriteMaterial({ map: texture, depthTest: true }),
      );
    }
    for (let i = 0; i < 48; i++) {
      const group = new THREE.Group(),
        material = this.material;
      const body = new THREE.Mesh(this.box, material),
        head = new THREE.Mesh(this.sphere, material);
      const arms = [
        new THREE.Mesh(this.box, material),
        new THREE.Mesh(this.box, material),
      ];
      const legs = [
        new THREE.Mesh(this.box, material),
        new THREE.Mesh(this.box, material),
      ];
      const ring = new THREE.Mesh(this.ring, this.warning);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 0.03;
      const crest = new THREE.Mesh(this.box, this.warning),
        label = new THREE.Sprite(this.labels.get("walker")!);
      // This detached hierarchy only computes matrices; GPU submission is batched.
      group.add(body, head, ...arms, ...legs, ring, crest);
      group.visible = false;
      label.visible = false;
      this.group.add(label);
      const color = new THREE.Color();
      for (let part = 0; part < 5; part++)
        this.bodies.setColorAt(i * 5 + part, color);
      this.heads.setColorAt(i, color);
      this.slots.push({
        group,
        body,
        head,
        arms,
        legs,
        ring,
        crest,
        label,
        color,
        id: "",
        revision: 0,
      });
    }
  }
  render(
    now: number,
    camera: THREE.Camera,
    reducedMotion: boolean,
    flashes = true,
  ) {
    for (let i = 0; i < this.slots.length; i++) {
      const track = this.store.slots[i]!,
        slot = this.slots[i]!,
        state = track.latest;
      if (!state || !track.id) {
        slot.group.visible = false;
        slot.label.visible = false;
        slot.id = "";
        slot.revision = 0;
        this.submit(i, slot);
        continue;
      }
      if (slot.id !== track.id || slot.revision !== track.revision) {
        slot.id = track.id;
        slot.revision = track.revision;
        const a = appearance[state.archetype],
          h = a.height,
          r = a.radius;
        slot.group.rotation.set(0, 0, 0);
        slot.group.scale.set(1, 1, 1);
        slot.color.setHex(a.color);
        slot.body.position.set(0, h * 0.5, 0);
        slot.body.scale.set(r * 1.65, h * 0.45, r * 1.3);
        slot.head.position.set(0, h * 0.875, 0);
        slot.head.scale.setScalar(h * 0.125);
        for (let limb = 0; limb < 2; limb++) {
          const sign = limb ? 1 : -1;
          slot.arms[limb]!.position.set(sign * (r + 0.07), h * 0.57, 0);
          slot.arms[limb]!.scale.set(0.15, h * 0.38, 0.17);
          slot.arms[limb]!.rotation.set(0, 0, 0);
          slot.legs[limb]!.position.set(sign * r * 0.48, h * 0.17, 0);
          slot.legs[limb]!.scale.set(r * 0.6, h * 0.34, r * 0.7);
          slot.legs[limb]!.rotation.set(0, 0, 0);
        }
        slot.crest.position.set(0, h * 0.72, -r);
        slot.crest.scale.set(
          r * 1.8,
          state.archetype === "screamer" ? 0.28 : 0.1,
          0.1,
        );
        slot.crest.visible =
          state.archetype === "screamer" || state.archetype === "spitter";
        slot.label.material = this.labels.get(state.archetype)!;
        slot.label.position.y = h + 0.38;
        slot.label.scale.set(1.7, 0.32, 1);
        slot.ring.visible = false;
      }
      track.sample(now);
      const p = track.transform;
      slot.group.position.set(p.x, p.y, p.z);
      slot.group.rotation.y = p.yaw;
      const dead = state.state === ZombieAI.Dead,
        windup = state.state === ZombieAI.Windup;
      slot.group.visible = !dead || now < state.stateUntil;
      const death = dead
        ? Math.max(0, Math.min(1, 1 - (state.stateUntil - now) / 900))
        : 0;
      slot.group.rotation.x = reducedMotion ? 0 : death * -1.4;
      slot.group.scale.y =
        dead && reducedMotion
          ? 0.2
          : state.state === ZombieAI.Spawning && !reducedMotion
            ? Math.max(0.2, Math.min(1, (now - state.spawnAt) / 600))
            : 1;
      slot.color.setHex(appearance[state.archetype].color);
      if (now < track.damageUntil && !reducedMotion && flashes)
        slot.color.lerp(this.hitColor, 0.25);
      const distanceSquared = camera.position.distanceToSquared(
        slot.group.position,
      );
      const far = distanceSquared > 625;
      const stride =
        !far && !reducedMotion && state.state === ZombieAI.Chasing
          ? Math.sin(now * (state.archetype === "runner" ? 0.018 : 0.009)) * 0.4
          : 0;
      slot.legs[0]!.rotation.x = stride;
      slot.legs[1]!.rotation.x = -stride;
      slot.arms[0]!.rotation.x = windup ? -1.7 : -0.2 - stride;
      slot.arms[1]!.rotation.x = windup ? -1.7 : -0.2 + stride;
      slot.ring.visible = windup && !dead;
      slot.ring.scale.setScalar(state.archetype === "brute" ? 2 : 1.2);
      slot.label.visible =
        !dead &&
        !far &&
        distanceSquared > 9 &&
        (windup || state.archetype !== "walker");
      slot.label.position.set(
        p.x,
        p.y + appearance[state.archetype].height + 0.38,
        p.z,
      );
      slot.group.updateMatrixWorld(true);
      this.submit(i, slot);
    }
    for (const batch of this.batches) batch.instanceMatrix.needsUpdate = true;
    this.bodies.instanceColor!.needsUpdate = true;
    this.heads.instanceColor!.needsUpdate = true;
  }
  private submit(index: number, slot: RenderSlot) {
    const visible = slot.group.visible;
    this.bodies.setMatrixAt(
      index * 5,
      visible ? slot.body.matrixWorld : this.hidden,
    );
    for (let side = 0; side < 2; side++) {
      this.bodies.setMatrixAt(
        index * 5 + 1 + side,
        visible ? slot.arms[side]!.matrixWorld : this.hidden,
      );
      this.bodies.setMatrixAt(
        index * 5 + 3 + side,
        visible ? slot.legs[side]!.matrixWorld : this.hidden,
      );
    }
    for (let part = 0; part < 5; part++)
      this.bodies.setColorAt(index * 5 + part, slot.color);
    this.heads.setColorAt(index, slot.color);
    this.heads.setMatrixAt(
      index,
      visible ? slot.head.matrixWorld : this.hidden,
    );
    this.rings.setMatrixAt(
      index,
      visible && slot.ring.visible ? slot.ring.matrixWorld : this.hidden,
    );
    this.crests.setMatrixAt(
      index,
      visible && slot.crest.visible ? slot.crest.matrixWorld : this.hidden,
    );
  }
  dispose() {
    this.store.reset();
    this.group.removeFromParent();
    for (const batch of this.batches) batch.dispose();
    this.box.dispose();
    this.sphere.dispose();
    this.ring.dispose();
    this.warning.dispose();
    this.material.dispose();
    for (const material of this.labels.values()) {
      material.map?.dispose();
      material.dispose();
    }
    this.group.clear();
    this.slots.length = 0;
    this.labels.clear();
  }
}
