import RAPIER from "@dimforge/rapier3d-compat";
import { ARENA_BOXES, FALLBACK_SPAWN, TARGETS } from "./arena";
import { MOVEMENT, RIFLE } from "./config";
import type { MotionState, PlayerInput, Vec3 } from "./protocol";

let initialization: Promise<void> | undefined;
export function initPhysics() {
  return (initialization ??= RAPIER.init());
}
const identity = { x: 0, y: 0, z: 0, w: 1 };
export function playerHeight(state: Pick<MotionState, "crouched">) {
  return state.crouched ? MOVEMENT.crouchingHeight : MOVEMENT.standingHeight;
}
export function createMotion(position: Vec3): MotionState {
  return {
    position: { ...position },
    velocity: { x: 0, y: 0, z: 0 },
    yaw: 0,
    pitch: 0,
    grounded: false,
    crouched: false,
    sprinting: false,
  };
}
export function enforceBounds(state: MotionState) {
  const p = state.position;
  if (
    ![p.x, p.y, p.z].every(Number.isFinite) ||
    Math.abs(p.x) > 16 ||
    Math.abs(p.z) > 20 ||
    p.y < -4 ||
    p.y > 12
  ) {
    Object.assign(p, FALLBACK_SPAWN);
    Object.assign(state.velocity, { x: 0, y: 0, z: 0 });
    state.grounded = false;
    return true;
  }
  return false;
}
const approach = (value: number, target: number, max: number) =>
  value + Math.max(-max, Math.min(max, target - value));

/** Identical static geometry and capsule move-and-slide on client and authority.
 * Teammates are non-blocking, avoiding prediction depending on remote timelines.
 */
export class ArenaPhysics {
  readonly world: RAPIER.World;
  private controller: RAPIER.KinematicCharacterController;
  private players = new Map<string, RAPIER.Collider>();
  private playerHandles = new Set<number>();
  private targetHandles = new Map<number, string>();
  private standing = new RAPIER.Capsule(
    MOVEMENT.standingHeight / 2 - MOVEMENT.radius,
    MOVEMENT.radius,
  );
  private crouching = new RAPIER.Capsule(
    MOVEMENT.crouchingHeight / 2 - MOVEMENT.radius,
    MOVEMENT.radius,
  );
  private delta = { x: 0, y: 0, z: 0 };
  private center = { x: 0, y: 0, z: 0 };
  private environment = (collider: RAPIER.Collider) =>
    !this.playerHandles.has(collider.handle);
  constructor(readonly dt: number) {
    this.world = new RAPIER.World({ x: 0, y: -MOVEMENT.gravity, z: 0 });
    this.world.timestep = dt;
    for (const b of ARENA_BOXES) {
      const desc = RAPIER.ColliderDesc.cuboid(
        b.half.x,
        b.half.y,
        b.half.z,
      ).setTranslation(b.position.x, b.position.y, b.position.z);
      if (b.rotationX)
        desc.setRotation({
          x: Math.sin(b.rotationX / 2),
          y: 0,
          z: 0,
          w: Math.cos(b.rotationX / 2),
        });
      this.world.createCollider(desc);
    }
    for (const t of TARGETS) {
      const collider = this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(t.half.x, t.half.y, t.half.z).setTranslation(
          t.position.x,
          t.position.y,
          t.position.z,
        ),
      );
      this.targetHandles.set(collider.handle, t.id);
    }
    this.controller = this.world.createCharacterController(MOVEMENT.skin);
    this.controller.setMaxSlopeClimbAngle(MOVEMENT.maxSlope);
    this.controller.setMinSlopeSlideAngle(MOVEMENT.maxSlope);
    this.controller.enableSnapToGround(0.2);
    this.controller.enableAutostep(0.18, 0.25, false);
    this.world.step();
  }
  private collider(id: string, state: MotionState) {
    let collider = this.players.get(id);
    if (!collider) {
      collider = this.world.createCollider(
        RAPIER.ColliderDesc.capsule(
          MOVEMENT.standingHeight / 2 - MOVEMENT.radius,
          MOVEMENT.radius,
        ),
      );
      this.players.set(id, collider);
      this.playerHandles.add(collider.handle);
    }
    collider.setShape(state.crouched ? this.crouching : this.standing);
    this.center.x = state.position.x;
    this.center.y = state.position.y + playerHeight(state) / 2;
    this.center.z = state.position.z;
    collider.setTranslation(this.center);
    return collider;
  }
  step(id: string, state: MotionState, input: PlayerInput) {
    enforceBounds(state);
    const collider = this.collider(id, state);
    if (input.crouch !== state.crouched) {
      this.center.y = state.position.y + MOVEMENT.standingHeight / 2;
      const blocked =
        !input.crouch &&
        this.world.intersectionWithShape(
          this.center,
          identity,
          this.standing,
          undefined,
          undefined,
          collider,
          undefined,
          this.environment,
        );
      if (!blocked) {
        state.crouched = input.crouch;
        this.collider(id, state);
      }
    }
    state.yaw = input.yaw;
    state.pitch = input.pitch;
    state.sprinting =
      input.sprint && !state.crouched && input.z < 0 && state.grounded;
    const speed = state.crouched
      ? MOVEMENT.crouch
      : state.sprinting
        ? MOVEMENT.sprint
        : MOVEMENT.walk;
    const length = Math.hypot(input.x, input.z) || 1;
    const x = input.x / length,
      z = input.z / length;
    const cos = Math.cos(input.yaw),
      sin = Math.sin(input.yaw);
    const accel =
      (state.grounded
        ? x || z
          ? MOVEMENT.acceleration
          : MOVEMENT.deceleration
        : MOVEMENT.airAcceleration) * this.dt;
    const desiredX = (x * cos + z * sin) * speed,
      desiredZ = (-x * sin + z * cos) * speed;
    const difference = Math.hypot(
      desiredX - state.velocity.x,
      desiredZ - state.velocity.z,
    );
    const fraction = difference ? Math.min(1, accel / difference) : 0;
    state.velocity.x = approach(
      state.velocity.x,
      desiredX,
      Math.abs(desiredX - state.velocity.x) * fraction,
    );
    state.velocity.z = approach(
      state.velocity.z,
      desiredZ,
      Math.abs(desiredZ - state.velocity.z) * fraction,
    );
    // Bound vector acceleration and speed, including diagonal input.
    const horizontal = Math.hypot(state.velocity.x, state.velocity.z);
    if (horizontal > speed) {
      state.velocity.x *= speed / horizontal;
      state.velocity.z *= speed / horizontal;
    }
    if (input.jump && state.grounded && !state.crouched)
      state.velocity.y = MOVEMENT.jumpSpeed;
    else
      state.velocity.y = Math.max(
        -MOVEMENT.terminalSpeed,
        state.velocity.y - MOVEMENT.gravity * this.dt,
      );
    this.delta.x = state.velocity.x * this.dt;
    this.delta.y = state.velocity.y * this.dt;
    this.delta.z = state.velocity.z * this.dt;
    this.controller.computeColliderMovement(
      collider,
      this.delta,
      undefined,
      undefined,
      this.environment,
    );
    const movement = this.controller.computedMovement();
    state.position.x += movement.x;
    state.position.y += movement.y;
    state.position.z += movement.z;
    state.grounded = this.controller.computedGrounded();
    if (state.grounded && state.velocity.y < 0) state.velocity.y = 0;
    if (state.velocity.y > 0 && movement.y < this.delta.y - MOVEMENT.skin)
      state.velocity.y = 0;
    enforceBounds(state);
    this.collider(id, state);
    this.world.step();
  }
  raycast(origin: Vec3, direction: Vec3, alive: (id: string) => boolean) {
    const ray = new RAPIER.Ray(origin, direction);
    const hit = this.world.castRay(
      ray,
      RIFLE.range,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      (c) =>
        this.environment(c) &&
        (!this.targetHandles.has(c.handle) ||
          alive(this.targetHandles.get(c.handle)!)),
    );
    const distance = hit?.timeOfImpact ?? RIFLE.range;
    return {
      point: ray.pointAt(distance),
      targetId: hit
        ? (this.targetHandles.get(hit.collider.handle) ?? null)
        : null,
    };
  }
  validSpawn(position: Vec3) {
    return !this.world.intersectionWithShape(
      {
        x: position.x,
        y: position.y + MOVEMENT.standingHeight / 2,
        z: position.z,
      },
      identity,
      this.standing,
      undefined,
      undefined,
      undefined,
      undefined,
      this.environment,
    );
  }
  dispose() {
    this.world.free();
    this.players.clear();
    this.playerHandles.clear();
    this.targetHandles.clear();
  }
}
