import * as THREE from "three";
import { ARENA_BOXES, TARGETS } from "../shared/arena";
import { MOVEMENT } from "../shared/config";
import { playerHeight } from "../shared/physics";
import type {
  MotionState,
  PlayerState,
  TargetState,
  Vec3,
} from "../shared/protocol";
import type { GameSettings } from "../shared/settings";
import { ZombieRenderer } from "./zombies";
interface Effect {
  line: THREE.Line;
  impact: THREE.Mesh;
  until: number;
  positions: Float32Array;
}
/** Procedural temporary industrial arena. No external asset requests. */
export class ArenaRenderer {
  readonly scene = new THREE.Scene();
  readonly zombies = new ZombieRenderer(this.scene);
  readonly camera = new THREE.PerspectiveCamera(80, 1, 0.05, 100);
  readonly renderer: THREE.WebGLRenderer;
  private boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  private materials = {
    concrete: new THREE.MeshStandardMaterial({
      color: 0x36404c,
      roughness: 0.95,
    }),
    steel: new THREE.MeshStandardMaterial({
      color: 0x414e59,
      roughness: 0.65,
      metalness: 0.4,
    }),
    crate: new THREE.MeshStandardMaterial({ color: 0x67644d, roughness: 0.8 }),
    blue: new THREE.MeshBasicMaterial({ color: 0x75c5f2 }),
    red: new THREE.MeshBasicMaterial({ color: 0xef647b }),
  };
  private weapon = new THREE.Group();
  private flash: THREE.Mesh;
  private recoil = 0;
  private muzzleUntil = 0;
  private remote = new THREE.Group();
  private remoteAim = new THREE.Group();
  private legs: THREE.Mesh[] = [];
  private labelCanvas = document.createElement("canvas");
  private labelTexture: THREE.CanvasTexture;
  private labelText = "";
  private effects: Effect[] = [];
  private effectIndex = 0;
  private targetMeshes = new Map<string, THREE.Mesh>();
  private resize: ResizeObserver;
  private abort = new AbortController();
  private disposed = false;
  private remoteFireUntil = 0;
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly contextChanged: (lost: boolean) => void,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.background = new THREE.Color(0x101823);
    this.scene.add(new THREE.HemisphereLight(0xb8d4e6, 0x414044, 2));
    const daylight = new THREE.DirectionalLight(0xd0e6ff, 2.4);
    daylight.position.set(-6, 12, 8);
    this.scene.add(daylight);
    this.scene.add(this.camera);
    this.camera.rotation.order = "YXZ";
    for (const b of ARENA_BOXES) {
      const mesh = this.box(
        b.position.x,
        b.position.y,
        b.position.z,
        b.half.x * 2,
        b.half.y * 2,
        b.half.z * 2,
        this.materials[b.material],
      );
      mesh.rotation.x = b.rotationX ?? 0;
    }
    // Repeated architectural elements share buffers and materials.
    for (let z = -18; z <= 18; z += 6) {
      this.box(-15.5, 3, z, 0.5, 6, 0.5, this.materials.steel);
      this.box(15.5, 3, z, 0.5, 6, 0.5, this.materials.steel);
      this.box(0, 5.7, z, 31, 0.2, 0.25, this.materials.steel);
    }
    for (const x of [-14, 14]) {
      this.box(x, 0.012, 0, 0.08, 0.015, 36, this.materials.blue);
      this.box(x, 4.4, -19.5, 2.4, 0.12, 0.1, this.materials.red);
    }
    for (const x of [-3, 3])
      this.box(x, 0.014, 14, 1.6, 0.02, 0.08, this.materials.blue);
    for (const t of TARGETS) {
      this.box(
        t.position.x,
        0.45,
        t.position.z,
        0.12,
        0.9,
        0.15,
        this.materials.steel,
      );
      const mesh = this.box(
        t.position.x,
        t.position.y,
        t.position.z,
        t.half.x * 2,
        t.half.y * 2,
        t.half.z * 2,
        new THREE.MeshStandardMaterial({ color: 0xf2b86b, roughness: 0.6 }),
      );
      this.targetMeshes.set(t.id, mesh);
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.18, 0.23, 24),
        this.materials.red,
      );
      ring.position.set(t.position.x, t.position.y, t.position.z + 0.16);
      this.scene.add(ring);
    }
    this.sign("QUARANTINE / 05", -7.5, 4.3, -19.5, 8, 1.2);
    this.sign("NORTH / CONTAINMENT", 7.5, 4.3, -19.5, 7, 1.2);
    this.sign("LIVE HOSTILES / STAY TOGETHER", 0, 3.1, -6.63, 4, 0.65);
    this.camera.add(this.weapon);
    this.weapon.position.set(0.28, -0.26, -0.48);
    this.localBox(this.weapon, 0, 0, 0, 0.12, 0.14, 0.43, this.materials.steel);
    this.localBox(
      this.weapon,
      0,
      -0.14,
      0.06,
      0.07,
      0.2,
      0.1,
      this.materials.concrete,
    );
    this.localBox(
      this.weapon,
      0,
      0,
      -0.3,
      0.05,
      0.05,
      0.25,
      this.materials.concrete,
    );
    this.localBox(
      this.weapon,
      0,
      0.09,
      -0.04,
      0.04,
      0.04,
      0.12,
      this.materials.concrete,
    );
    this.flash = new THREE.Mesh(
      new THREE.ConeGeometry(0.06, 0.16, 5),
      new THREE.MeshBasicMaterial({ color: 0xffdba0 }),
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flash.position.z = -0.47;
    this.flash.visible = false;
    this.weapon.add(this.flash);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: 0x80a9c7,
      roughness: 0.9,
    });
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.27, 0.55, 4, 8),
      bodyMaterial,
    );
    body.position.y = 1.05;
    this.remote.add(body);
    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.23, 12, 8),
      this.materials.steel,
    );
    head.position.y = 1.62;
    this.remote.add(head);
    this.localBox(
      this.remote,
      0,
      1.65,
      -0.2,
      0.32,
      0.075,
      0.12,
      this.materials.blue,
    );
    for (const x of [-0.14, 0.14]) {
      const leg = new THREE.Mesh(this.boxGeometry, this.materials.steel);
      leg.scale.set(0.19, 0.6, 0.2);
      leg.position.set(x, 0.35, 0);
      this.remote.add(leg);
      this.legs.push(leg);
    }
    this.remoteAim.position.set(0.28, 1.25, -0.1);
    this.remote.add(this.remoteAim);
    this.localBox(
      this.remoteAim,
      0,
      0,
      -0.25,
      0.1,
      0.1,
      0.6,
      this.materials.steel,
    );
    this.localBox(this.remoteAim, -0.18, 0, 0, 0.32, 0.13, 0.15, bodyMaterial);
    this.labelCanvas.width = 512;
    this.labelCanvas.height = 80;
    this.labelTexture = new THREE.CanvasTexture(this.labelCanvas);
    const label = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: this.labelTexture, depthTest: false }),
    );
    label.position.y = 2.18;
    label.scale.set(2.8, 0.44, 1);
    this.remote.add(label);
    this.remote.visible = false;
    this.scene.add(this.remote);
    const effectGeometry = new THREE.SphereGeometry(0.045, 6, 4),
      effectMaterial = new THREE.MeshBasicMaterial({ color: 0xffdba0 });
    const tracerMaterial = new THREE.LineBasicMaterial({
      color: 0xeed6a8,
      transparent: true,
      opacity: 0.7,
    });
    for (let i = 0; i < 12; i++) {
      const positions = new Float32Array(6);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute(
        "position",
        new THREE.BufferAttribute(positions, 3),
      );
      const line = new THREE.Line(geometry, tracerMaterial);
      line.frustumCulled = false;
      line.visible = false;
      const impact = new THREE.Mesh(effectGeometry, effectMaterial);
      impact.visible = false;
      this.scene.add(line, impact);
      this.effects.push({ line, impact, until: 0, positions });
    }
    this.resize = new ResizeObserver(() => this.resizeCanvas());
    this.resize.observe(canvas);
    this.resizeCanvas();
    canvas.addEventListener(
      "webglcontextlost",
      (event) => {
        event.preventDefault();
        contextChanged(true);
      },
      { signal: this.abort.signal },
    );
    canvas.addEventListener(
      "webglcontextrestored",
      () => contextChanged(false),
      { signal: this.abort.signal },
    );
  }
  private box(
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
  ) {
    return this.localBox(this.scene, x, y, z, w, h, d, material);
  }
  private localBox(
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    material: THREE.Material,
  ) {
    const mesh = new THREE.Mesh(this.boxGeometry, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  }
  private sign(
    text: string,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#17222f";
    ctx.fillRect(0, 0, 1024, 160);
    ctx.fillStyle = "#d4e7f4";
    ctx.font = "bold 58px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(text, 512, 103);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    const sign = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map }),
    );
    sign.position.set(x, y, z);
    this.scene.add(sign);
  }
  private resizeCanvas() {
    if (this.disposed) return;
    const w = this.canvas.clientWidth,
      h = this.canvas.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  async prepare() {
    await this.renderer.compileAsync(this.scene, this.camera);
  }
  localShot() {
    this.muzzleUntil = performance.now() + 55;
    this.recoil = Math.min(1, this.recoil + 0.8);
  }
  remoteShot() {
    this.remoteFireUntil = performance.now() + 180;
  }
  impact(origin: Vec3, point: Vec3, flashes: boolean) {
    const e = this.effects[this.effectIndex++ % this.effects.length]!;
    e.positions.set([origin.x, origin.y, origin.z, point.x, point.y, point.z]);
    e.line.geometry.attributes.position!.needsUpdate = true;
    e.line.visible = flashes;
    e.impact.position.set(point.x, point.y, point.z);
    e.impact.visible = true;
    e.until = performance.now() + 220;
  }
  updateTargets(targets: TargetState[]) {
    for (const target of targets) {
      const mesh = this.targetMeshes.get(target.id);
      if (mesh)
        (mesh.material as THREE.MeshStandardMaterial).color.setHex(
          target.health ? 0xf2b86b : 0x393f48,
        );
    }
  }
  remoteState(
    motion: MotionState,
    state: PlayerState | undefined,
    time: number,
  ) {
    this.remote.visible = !!state;
    if (!state) return;
    this.remote.position.set(
      motion.position.x,
      motion.position.y,
      motion.position.z,
    );
    this.remote.rotation.y = motion.yaw;
    this.remote.visible = state.life !== "ELIMINATED";
    this.remote.scale.y =
      state.life === "DOWNED" ? 0.35 : motion.crouched ? 0.65 : 1;
    this.remoteAim.rotation.x = motion.pitch;
    const speed = Math.hypot(motion.velocity.x, motion.velocity.z),
      stride = motion.grounded
        ? Math.sin(time * 0.012 * (motion.sprinting ? 1.4 : 1)) *
          Math.min(speed / 12, 0.35)
        : 0.3;
    this.legs[0]!.rotation.x = stride;
    this.legs[1]!.rotation.x = -stride;
    this.remoteAim.position.z = time < this.remoteFireUntil ? -0.04 : -0.1;
    const text = `${state.name} · ${!state.connected ? "Reconnecting" : state.life === "DOWNED" ? "DOWNED · Hold E to revive" : `${state.health} HP`}`;
    if (text !== this.labelText) {
      this.labelText = text;
      const ctx = this.labelCanvas.getContext("2d")!;
      ctx.clearRect(0, 0, 512, 80);
      ctx.fillStyle = "rgba(7,9,18,0.92)";
      ctx.fillRect(0, 0, 512, 80);
      ctx.fillStyle = "#f1f3ff";
      ctx.font = "26px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(text.slice(0, 42), 256, 49);
      this.labelTexture.needsUpdate = true;
    }
  }
  render(
    local: MotionState,
    offset: Vec3,
    look: { yaw: number; pitch: number },
    settings: GameSettings,
    delta: number,
    reloading: boolean,
  ) {
    const time = performance.now();
    this.recoil *= Math.exp(-delta * 18);
    this.camera.position.set(
      local.position.x + offset.x,
      local.position.y + playerHeight(local) - MOVEMENT.eyeInset + offset.y,
      local.position.z + offset.z,
    );
    this.camera.rotation.set(
      look.pitch +
        (settings.cameraShake && !settings.reducedMotion
          ? this.recoil * 0.003
          : 0),
      look.yaw,
      0,
      "YXZ",
    );
    if (this.camera.fov !== settings.fov) {
      this.camera.fov = settings.fov;
      this.camera.updateProjectionMatrix();
    }
    const bob = settings.reducedMotion
      ? 0
      : Math.sin(time * 0.009) *
        Math.min(Math.hypot(local.velocity.x, local.velocity.z) * 0.0015, 0.01);
    this.weapon.position.y = -0.26 + bob - (reloading ? 0.1 : 0);
    this.weapon.position.z = -0.48 + this.recoil * 0.04;
    this.weapon.rotation.x = reloading ? -0.35 : this.recoil * 0.04;
    this.flash.visible =
      time < this.muzzleUntil &&
      settings.screenFlashes &&
      !settings.reducedMotion;
    for (const e of this.effects) {
      if (time >= e.until) {
        e.line.visible = false;
        e.impact.visible = false;
      } else if (time > e.until - 170) e.line.visible = false;
    }
    this.renderer.render(this.scene, this.camera);
  }
  projectRemote(out: THREE.Vector3) {
    return out.copy(this.remote.position).project(this.camera);
  }
  weaponVisible(visible: boolean) {
    this.weapon.visible = visible;
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.abort.abort();
    this.resize.disconnect();
    this.zombies.dispose();
    const geometries = new Set<THREE.BufferGeometry>(),
      materials = new Set<THREE.Material>(),
      textures = new Set<THREE.Texture>();
    this.scene.traverse((object) => {
      if (
        object instanceof THREE.Mesh ||
        object instanceof THREE.Line ||
        object instanceof THREE.Sprite
      ) {
        if ("geometry" in object) geometries.add(object.geometry);
        for (const material of Array.isArray(object.material)
          ? object.material
          : [object.material]) {
          materials.add(material);
          if ("map" in material && material.map instanceof THREE.Texture)
            textures.add(material.map);
        }
      }
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    textures.forEach((t) => t.dispose());
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.scene.clear();
  }
}
