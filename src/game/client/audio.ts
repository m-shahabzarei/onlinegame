import type { Vec3 } from "../shared/protocol";
import type { WeaponDefinition } from "../shared/phase6";
export type Sound =
  | "synth-rifle"
  | "synth-reload"
  | "pistol-fire"
  | "pistol-reload"
  | "smg-fire"
  | "smg-reload"
  | "shotgun-fire"
  | "shotgun-reload"
  | "heavy-fire"
  | "heavy-reload"
  | "fire"
  | "reload"
  | "empty"
  | "impact"
  | "zombieIdle"
  | "zombieAttack"
  | "zombieImpact"
  | "zombieDeath"
  | "spitter"
  | "spit"
  | "brute"
  | "scream"
  | "damaged"
  | "downed"
  | "reviveProgress"
  | "reviveComplete"
  | "waveStart"
  | "waveClear"
  | "defeat"
  | "complete";
export const cues: Record<Sound, readonly [number, number, number]> = {
  "synth-rifle": [160, 45, 0.09],
  "synth-reload": [330, 130, 0.24],
  "pistol-fire": [420, 90, 0.075],
  "pistol-reload": [580, 260, 0.15],
  "smg-fire": [250, 65, 0.055],
  "smg-reload": [440, 190, 0.2],
  "shotgun-fire": [85, 22, 0.23],
  "shotgun-reload": [180, 60, 0.42],
  "heavy-fire": [110, 28, 0.3],
  "heavy-reload": [240, 80, 0.34],
  fire: [160, 45, 0.09],
  reload: [330, 130, 0.24],
  empty: [90, 130, 0.045],
  impact: [1000, 130, 0.045],
  zombieIdle: [65, 48, 0.25],
  zombieAttack: [95, 160, 0.35],
  zombieImpact: [65, 30, 0.12],
  zombieDeath: [180, 35, 0.3],
  spitter: [280, 580, 0.5],
  spit: [850, 240, 0.14],
  brute: [40, 100, 0.7],
  scream: [330, 1000, 0.8],
  damaged: [110, 45, 0.13],
  downed: [240, 60, 0.65],
  reviveProgress: [440, 460, 0.09],
  reviveComplete: [330, 880, 0.6],
  waveStart: [220, 550, 0.45],
  waveClear: [440, 660, 0.45],
  defeat: [240, 40, 0.9],
  complete: [330, 990, 0.9],
};
/** Locally synthesized temporary audio. No downloaded or third-party recordings. */
export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private active = new Map<
    OscillatorNode,
    { gain: GainNode; panner: PannerNode | null; sound: Sound }
  >();
  private lastSound = new Map<Sound, number>();
  private listenerPosition: Vec3 = { x: 0, y: 0, z: 0 };
  async unlock(volume: number) {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.connect(this.context.destination);
    }
    this.volume(volume);
    await this.context.resume();
  }
  volume(value: number) {
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }
  listener(position: Vec3, yaw: number, pitch: number) {
    Object.assign(this.listenerPosition, position);
    if (!this.context) return;
    const listener = this.context.listener;
    if (listener.positionX) {
      listener.positionX.value = position.x;
      listener.positionY.value = position.y;
      listener.positionZ.value = position.z;
      listener.forwardX.value = -Math.sin(yaw) * Math.cos(pitch);
      listener.forwardY.value = Math.sin(pitch);
      listener.forwardZ.value = -Math.cos(yaw) * Math.cos(pitch);
      listener.upX.value = 0;
      listener.upY.value = 1;
      listener.upZ.value = 0;
    }
  }
  playWeapon(
    event: "fire" | "reload",
    weapon: WeaponDefinition,
    position?: Vec3,
  ) {
    const cue = event === "fire" ? weapon.fireAudio : weapon.reloadAudio;
    if (Object.hasOwn(cues, cue)) this.play(cue as Sound, position);
  }
  play(sound: Sound, position?: Vec3) {
    const ctx = this.context;
    if (
      !ctx ||
      !this.master ||
      ctx.state !== "running" ||
      this.active.size >= 16
    )
      return;
    const important = [
      "damaged",
      "downed",
      "scream",
      "reviveComplete",
      "defeat",
      "complete",
    ].includes(sound);
    if (this.active.size >= 12 && !important) return;
    if (
      position &&
      Math.hypot(
        position.x - this.listenerPosition.x,
        position.y - this.listenerPosition.y,
        position.z - this.listenerPosition.z,
      ) > 32
    )
      return;
    if (ctx.currentTime - (this.lastSound.get(sound) ?? -100) < 0.075) return;
    let identical = 0;
    for (const node of this.active.values())
      if (node.sound === sound) identical++;
    if (identical >= 2) return;
    this.lastSound.set(sound, ctx.currentTime);
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    const now = ctx.currentTime,
      [startFrequency, endFrequency, duration] = cues[sound];
    const firing =
      sound === "fire" || sound === "synth-rifle" || sound.endsWith("-fire");
    oscillator.type = firing ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(startFrequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      endFrequency,
      now + duration,
    );
    gain.gain.setValueAtTime(firing ? 0.16 : 0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    oscillator.connect(gain);
    let panner: PannerNode | null = null;
    if (position) {
      panner = ctx.createPanner();
      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 3;
      panner.maxDistance = 65;
      panner.positionX.value = position.x;
      panner.positionY.value = position.y;
      panner.positionZ.value = position.z;
      gain.connect(panner);
      panner.connect(this.master);
    } else gain.connect(this.master);
    this.active.set(oscillator, { gain, panner, sound });
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
      panner?.disconnect();
      this.active.delete(oscillator);
    };
    oscillator.start(now);
    oscillator.stop(now + duration);
  }
  dispose() {
    for (const [oscillator, nodes] of this.active) {
      oscillator.onended = null;
      oscillator.stop();
      oscillator.disconnect();
      nodes.gain.disconnect();
      nodes.panner?.disconnect();
    }
    this.active.clear();
    this.lastSound.clear();
    this.master?.disconnect();
    void this.context?.close();
    this.context = null;
    this.master = null;
  }
}
