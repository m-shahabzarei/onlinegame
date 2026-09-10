import type { PlayerInput } from "../shared/protocol";
import { neutralInput } from "../shared/protocol";
import type { GameSettings } from "../shared/settings";
export const BINDINGS = {
  forward: ["KeyW"],
  backward: ["KeyS"],
  left: ["KeyA"],
  right: ["KeyD"],
  sprint: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  crouch: ["ControlLeft", "ControlRight", "KeyC"],
  reload: ["KeyR"],
  interact: ["KeyE"],
  primary: ["Digit1"],
  secondary: ["Digit2"],
  shop: ["KeyB"],
} as const;
const gameplayKeys = new Set<string>(Object.values(BINDINGS).flat());
export class GameInput {
  yaw = 0;
  pitch = 0;
  firing = false;
  locked = false;
  interacting = false;
  suspended = false;
  triggerSeq = 0;
  private keys = new Set<string>();
  private jump = false;
  private abort = new AbortController();
  constructor(
    readonly canvas: HTMLCanvasElement,
    readonly settings: () => GameSettings,
    readonly canPlay: () => boolean,
    readonly focus: (locked: boolean, error?: string) => void,
    readonly reload: () => void,
    readonly interact: (held: boolean) => void = () => {},
    readonly shop: () => void = () => {},
    readonly switchSlot: (slot: "primary" | "secondary") => void = () => {},
    readonly triggerRelease: (seq: number) => void = () => {},
  ) {
    const options = { signal: this.abort.signal };
    document.addEventListener(
      "pointerlockchange",
      () => {
        this.locked = document.pointerLockElement === canvas;
        if (!this.locked) this.clear();
        focus(this.locked);
      },
      options,
    );
    document.addEventListener(
      "pointerlockerror",
      () => {
        this.clear();
        focus(false, "POINTER_LOCK_DENIED");
      },
      options,
    );
    document.addEventListener(
      "mousemove",
      (event) => {
        if (!this.active()) return;
        const settings = this.settings(),
          scale = 0.002 * settings.sensitivity;
        this.yaw = Math.atan2(
          Math.sin(this.yaw - event.movementX * scale),
          Math.cos(this.yaw - event.movementX * scale),
        );
        this.pitch = Math.max(
          -1.48,
          Math.min(
            1.48,
            this.pitch - event.movementY * scale * (settings.invertY ? -1 : 1),
          ),
        );
      },
      options,
    );
    document.addEventListener(
      "keydown",
      (event) => {
        const target = event.target;
        if (
          target instanceof HTMLElement &&
          (target.isContentEditable ||
            /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
        )
          return;
        if (event.code === "KeyB" && !event.repeat) {
          event.preventDefault();
          this.shop();
          return;
        }
        if (!this.active()) return;
        if (gameplayKeys.has(event.code)) event.preventDefault();
        if (event.code === "Escape") {
          this.release();
          return;
        }
        if (event.code === "Space" && !event.repeat) this.jump = true;
        if (event.code === "KeyR" && !event.repeat) this.reload();
        if (event.code === "Digit1" && !event.repeat)
          this.switchSlot("primary");
        if (event.code === "Digit2" && !event.repeat)
          this.switchSlot("secondary");
        if (event.code === "KeyE" && !event.repeat) {
          this.interacting = true;
          this.interact(true);
        }
        this.keys.add(event.code);
      },
      options,
    );
    document.addEventListener(
      "keyup",
      (event) => {
        this.keys.delete(event.code);
        if (event.code === "KeyE") {
          this.interacting = false;
          this.interact(false);
        }
      },
      options,
    );
    document.addEventListener(
      "mousedown",
      (event) => {
        if (this.active() && event.button === 0 && !this.firing) {
          event.preventDefault();
          this.triggerSeq++;
          this.firing = true;
        }
      },
      options,
    );
    document.addEventListener(
      "mouseup",
      (event) => {
        if (event.button === 0) this.releaseTrigger();
      },
      options,
    );
    canvas.addEventListener(
      "contextmenu",
      (event) => {
        if (this.active()) event.preventDefault();
      },
      options,
    );
    window.addEventListener("blur", () => this.release(), options);
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) this.release();
      },
      options,
    );
  }
  active() {
    return this.locked && !this.suspended && this.canPlay() && !document.hidden;
  }
  private held(binding: readonly string[]) {
    return binding.some((code) => this.keys.has(code));
  }
  collect(seq: number, tick: number): PlayerInput {
    const input = neutralInput(seq, tick, this.yaw, this.pitch);
    if (this.active()) {
      input.x =
        Number(this.held(BINDINGS.right)) - Number(this.held(BINDINGS.left));
      input.z =
        Number(this.held(BINDINGS.backward)) -
        Number(this.held(BINDINGS.forward));
      input.sprint = this.held(BINDINGS.sprint);
      input.crouch = this.held(BINDINGS.crouch);
      input.jump = this.jump;
    }
    this.jump = false;
    return input;
  }
  async enter() {
    try {
      await this.canvas.requestPointerLock();
    } catch {
      this.focus(false, "POINTER_LOCK_DENIED");
    }
  }
  clear() {
    if (this.interacting) {
      this.interacting = false;
      this.interact(false);
    }
    this.keys.clear();
    this.releaseTrigger();
    this.jump = false;
  }
  release() {
    this.clear();
    this.locked = false;
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }
  private releaseTrigger() {
    if (this.firing) this.triggerRelease(this.triggerSeq);
    this.firing = false;
  }
  dispose() {
    this.release();
    this.abort.abort();
  }
}
