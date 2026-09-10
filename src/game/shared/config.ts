import { z } from "zod";

export const PROTOCOL_VERSION = 2 as const;
export const MAP_ID = "quarantine-yard" as const;
export const MAP_VERSION = 2 as const;
export const simulationConfigSchema = z
  .object({
    tickRate: z.number().int().min(20).max(60),
    snapshotRate: z.number().int().min(10).max(30),
    inputRate: z.number().int().min(20).max(60),
    countdownMs: z.number().int().min(100).max(10000),
    startupMs: z.number().int().min(1000).max(180000),
    reconnectMs: z.number().int().min(1000).max(75000),
    health: z.number().int().positive().max(1000),
  })
  .strict()
  .refine(
    (c) => c.inputRate === c.tickRate && c.tickRate % c.snapshotRate === 0,
    "Input and simulation steps must match; snapshots must divide the tick rate.",
  );
export type SimulationConfig = z.infer<typeof simulationConfigSchema>;
export const SIMULATION = simulationConfigSchema.parse({
  tickRate: 30,
  snapshotRate: 15,
  inputRate: 30,
  countdownMs: 3000,
  startupMs: 90000,
  reconnectMs: 30000,
  health: 100,
});
export const MOVEMENT = Object.freeze({
  walk: 4.8,
  sprint: 7.2,
  crouch: 2.4,
  acceleration: 28,
  deceleration: 32,
  airAcceleration: 7,
  gravity: 22,
  jumpSpeed: 7,
  terminalSpeed: 30,
  radius: 0.32,
  standingHeight: 1.8,
  crouchingHeight: 1.15,
  eyeInset: 0.16,
  skin: 0.015,
  maxSlope: Math.PI / 4,
});
export const RIFLE = Object.freeze({
  id: "ar-01",
  name: "AR-01 / Service rifle",
  magazine: 30,
  reserve: 120,
  fireMode: "automatic",
  fireIntervalMs: 150,
  reloadMs: 1800,
  range: 65,
  baseSpread: 0.001,
  movementSpread: 0.004,
  recoilPitch: 0.012,
  targetDamage: 25,
  impactEffect: "metal-spark",
  fireAudio: "synth-rifle",
  reloadAudio: "synth-reload",
  emptyAudio: "synth-empty",
});
export const LIMITS = Object.freeze({
  payloadBytes: 4096,
  inputQueue: 12,
  inputHistory: 180,
  snapshots: 32,
  inputTickWindow: 60,
  inputSequenceWindow: 120,
  interpolationMs: 100,
  extrapolationMs: 100,
  hardCorrection: 1.5,
  smoothingSeconds: 0.1,
  handshakeMs: 5000,
  heartbeatMs: 2000,
  silenceMs: 8000,
  leaseMs: 45000,
  leaseRenewMs: 10000,
  ticketMs: 30000,
  maxMatches: 100,
  maxConnections: 240,
  violationRefillRate: 2,
  violationBurst: 20,
  maxSessionMs: 2 * 60 * 60 * 1000,
});
