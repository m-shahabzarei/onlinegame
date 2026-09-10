import { z } from "zod";
import {
  archetypeSchema,
  emptyWave,
  waveTerminal,
  type Archetype,
  type WaveSnapshot,
  type WaveState,
} from "../../../src/game/shared/pve";
import { ZOMBIES } from "./definitions";

export const waveConfigSchema = z
  .object({
    number: z.number().int().min(1).max(10),
    budget: z.number().int().min(1).max(120),
    weights: z
      .array(
        z
          .object({
            archetype: archetypeSchema,
            weight: z.number().positive().max(100),
          })
          .strict(),
      )
      .min(1)
      .max(5),
    guaranteed: z.array(archetypeSchema).max(10),
    cap: z.number().int().min(1).max(24),
    interval: z.tuple([
      z.number().int().min(100).max(10000),
      z.number().int().min(100).max(10000),
    ]),
    initialDelayMs: z.number().int().min(0).max(10000),
    intermissionMs: z.number().int().min(100).max(60000),
    health: z.number().min(0.8).max(1.4),
    damage: z.number().min(0.8).max(1.3),
    speed: z.number().min(0.8).max(1.15),
    specialLimits: z
      .object({
        spitter: z.number().int().min(0).max(8),
        brute: z.number().int().min(0).max(4),
        screamer: z.number().int().min(0).max(3),
      })
      .strict(),
    reinforcementLimit: z.number().int().min(0).max(6),
  })
  .strict()
  .superRefine((w, ctx) => {
    const allowed = new Set(w.weights.map((x) => x.archetype));
    if (
      allowed.size !== w.weights.length ||
      !allowed.has("walker") ||
      w.interval[0] > w.interval[1] ||
      w.guaranteed.some((a) => !allowed.has(a)) ||
      w.guaranteed.reduce((n, a) => n + ZOMBIES.get(a).cost, 0) > w.budget ||
      (Object.entries(w.specialLimits) as [Archetype, number][]).some(
        ([a, limit]) => w.guaranteed.filter((g) => g === a).length > limit,
      )
    )
      ctx.addIssue({
        code: "custom",
        message: "Invalid wave composition or interval",
      });
  });
export type WaveConfig = z.infer<typeof waveConfigSchema>;
export function validateWaves(values: unknown): readonly WaveConfig[] {
  const waves = z.array(waveConfigSchema).min(5).max(10).parse(values);
  if (waves.some((w, i) => w.number !== i + 1))
    throw new Error("Waves must be sequentially numbered");
  return waves;
}
const weights = (...entries: [Archetype, number][]) =>
  entries.map(([archetype, weight]) => ({ archetype, weight }));
export const WAVES = validateWaves([
  {
    number: 1,
    budget: 8,
    weights: weights(["walker", 1]),
    guaranteed: [],
    cap: 4,
    interval: [1800, 2300],
    initialDelayMs: 2000,
    intermissionMs: 12000,
    health: 1,
    damage: 1,
    speed: 1,
    specialLimits: { spitter: 0, brute: 0, screamer: 0 },
    reinforcementLimit: 0,
  },
  {
    number: 2,
    budget: 14,
    weights: weights(["walker", 6], ["runner", 4]),
    guaranteed: ["runner", "runner"],
    cap: 7,
    interval: [1200, 1800],
    initialDelayMs: 1500,
    intermissionMs: 14000,
    health: 1,
    damage: 1,
    speed: 1,
    specialLimits: { spitter: 0, brute: 0, screamer: 0 },
    reinforcementLimit: 0,
  },
  {
    number: 3,
    budget: 22,
    weights: weights(["walker", 5], ["runner", 3], ["spitter", 2]),
    guaranteed: ["spitter"],
    cap: 12,
    interval: [800, 1400],
    initialDelayMs: 1200,
    intermissionMs: 16000,
    health: 1.05,
    damage: 1.05,
    speed: 1,
    specialLimits: { spitter: 3, brute: 0, screamer: 0 },
    reinforcementLimit: 0,
  },
  {
    number: 4,
    budget: 32,
    weights: weights(
      ["walker", 4],
      ["runner", 3],
      ["spitter", 2],
      ["brute", 1],
    ),
    guaranteed: ["brute", "spitter"],
    cap: 18,
    interval: [650, 1100],
    initialDelayMs: 1200,
    intermissionMs: 18000,
    health: 1.1,
    damage: 1.1,
    speed: 1.03,
    specialLimits: { spitter: 4, brute: 2, screamer: 0 },
    reinforcementLimit: 0,
  },
  {
    number: 5,
    budget: 44,
    weights: weights(
      ["walker", 4],
      ["runner", 3],
      ["spitter", 2],
      ["brute", 1],
      ["screamer", 1],
    ),
    guaranteed: ["screamer", "brute", "spitter", "runner", "walker"],
    cap: 24,
    interval: [450, 900],
    initialDelayMs: 1000,
    intermissionMs: 18000,
    health: 1.15,
    damage: 1.15,
    speed: 1.05,
    specialLimits: { spitter: 5, brute: 3, screamer: 2 },
    reinforcementLimit: 4,
  },
]);
export const PHASE6_WAVES = validateWaves([
  ...WAVES,
  ...([6, 7, 8, 9, 10] as const).map((number) => {
    const base = WAVES[Math.min(4, number - 1)]!;
    return {
      ...base,
      number,
      budget: Math.min(120, base.budget + (number - 5) * 10),
      cap: Math.min(24, base.cap),
      health: Math.min(1.4, base.health + (number - 5) * 0.03),
      damage: Math.min(1.3, base.damage + (number - 5) * 0.025),
      speed: Math.min(1.15, base.speed + (number - 5) * 0.015),
      intermissionMs: 30000,
    };
  }),
]);
export class DifficultySystem {
  static stats(archetype: Archetype, wave: WaveConfig) {
    const d = ZOMBIES.get(archetype);
    return {
      health: Math.ceil(d.health * wave.health),
      damage: Math.ceil(d.damage * wave.damage),
      speed: d.speed * wave.speed,
    };
  }
}
const transitions: Record<WaveState, readonly WaveState[]> = {
  PREPARING: ["COUNTDOWN", "CANCELLED", "ERROR"],
  COUNTDOWN: ["PREPARING", "ACTIVE", "CANCELLED", "ERROR"],
  ACTIVE: ["CLEARING", "TEAM_DEFEATED", "CANCELLED", "ERROR"],
  CLEARING: [
    "INTERMISSION",
    "PHASE_COMPLETE",
    "TEAM_DEFEATED",
    "CANCELLED",
    "ERROR",
  ],
  INTERMISSION: ["ACTIVE", "TEAM_DEFEATED", "CANCELLED", "ERROR"],
  PHASE_COMPLETE: [],
  TEAM_DEFEATED: [],
  CANCELLED: [],
  ERROR: [],
};
export class WaveDirector {
  readonly state = emptyWave();
  readonly queue: Archetype[] = [];
  private plan: Archetype[] = [];
  private nextSchedule = 0;
  constructor(
    readonly random: () => number,
    readonly changed: (wave: WaveSnapshot) => void,
    readonly configs: readonly WaveConfig[] = WAVES,
  ) {
    validateWaves(configs);
    this.state.total = configs.length as 5 | 10;
  }
  get config() {
    return this.configs[Math.max(0, this.state.number - 1)]!;
  }
  change(next: WaveState, until = 0, reason = "") {
    if (this.state.state === next) return false;
    if (!transitions[this.state.state].includes(next))
      throw new Error(`Invalid wave transition ${this.state.state} -> ${next}`);
    this.state.state = next;
    this.state.until = until;
    this.state.reason = reason;
    this.state.revision++;
    if (waveTerminal(next)) {
      this.queue.length = 0;
      this.state.queued = 0;
    }
    this.changed({ ...this.state });
    return true;
  }
  countdown(until: number) {
    this.change("COUNTDOWN", until);
  }
  prepare() {
    if (this.state.state === "COUNTDOWN") this.change("PREPARING");
  }
  private start(now: number) {
    if (this.state.number >= this.configs.length)
      throw new Error("No further waves in this content profile");
    this.state.number++;
    const config = this.config;
    this.plan = [...config.guaranteed];
    let budget =
      config.budget - this.plan.reduce((n, a) => n + ZOMBIES.get(a).cost, 0);
    while (budget > 0) {
      const candidates = config.weights.filter(
        (w) =>
          ZOMBIES.get(w.archetype).cost <= budget &&
          (!(w.archetype in config.specialLimits) ||
            this.plan.filter((a) => a === w.archetype).length <
              config.specialLimits[
                w.archetype as keyof typeof config.specialLimits
              ]),
      );
      if (!candidates.length) throw new Error("Unspendable wave budget");
      let roll = this.random() * candidates.reduce((n, c) => n + c.weight, 0);
      let choice = candidates[0]!.archetype;
      for (const c of candidates) {
        roll -= c.weight;
        if (roll < 0) {
          choice = c.archetype;
          break;
        }
      }
      this.plan.push(choice);
      budget -= ZOMBIES.get(choice).cost;
    }
    this.queue.length = 0;
    Object.assign(this.state, {
      planned: this.plan.length,
      scheduled: 0,
      queued: 0,
      alive: 0,
      defeated: 0,
      reinforcements: 0,
      reinforcementLimit: config.reinforcementLimit,
    });
    this.nextSchedule = now + config.initialDelayMs;
    this.change("ACTIVE");
  }
  update(now: number, alive: number) {
    this.state.alive = alive;
    if (
      (this.state.state === "COUNTDOWN" ||
        this.state.state === "INTERMISSION") &&
      now >= this.state.until
    )
      this.start(now);
    if (this.state.state !== "ACTIVE" && this.state.state !== "CLEARING")
      return;
    if (this.state.scheduled < this.plan.length && now >= this.nextSchedule) {
      this.queue.push(this.plan[this.state.scheduled++]!);
      this.nextSchedule =
        now +
        this.config.interval[0] +
        this.random() * (this.config.interval[1] - this.config.interval[0]);
    }
    this.state.queued = this.queue.length;
    if (
      this.state.scheduled === this.state.planned &&
      this.queue.length === 0 &&
      this.state.state === "ACTIVE"
    )
      this.change("CLEARING");
    if (this.state.state === "CLEARING" && this.canClear()) {
      this.change(
        this.state.number === this.configs.length
          ? "PHASE_COMPLETE"
          : "INTERMISSION",
        this.state.number === this.configs.length
          ? 0
          : now + this.config.intermissionMs,
      );
    }
  }
  canClear() {
    return (
      this.state.scheduled === this.state.planned &&
      this.queue.length === 0 &&
      this.state.alive === 0
    );
  }
  spawned() {
    this.queue.shift();
    this.state.queued = this.queue.length;
    this.state.alive++;
  }
  defeated() {
    this.state.defeated++;
    this.state.alive = Math.max(0, this.state.alive - 1);
  }
  reinforce(requested: number) {
    if (this.state.state !== "ACTIVE" && this.state.state !== "CLEARING")
      return 0;
    const count = Math.min(
      requested,
      this.config.reinforcementLimit - this.state.reinforcements,
    );
    for (let i = 0; i < count; i++) this.queue.push("walker");
    this.state.reinforcements += count;
    this.state.queued = this.queue.length;
    return count;
  }
}
