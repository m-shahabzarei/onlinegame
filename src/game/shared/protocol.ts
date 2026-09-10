import { z } from "zod";
import {
  lifeFields,
  pveSnapshotSchema,
  pveEventSchema,
  waveSchema,
} from "./pve";
import {
  MAP_ID,
  MAP_VERSION,
  PROTOCOL_VERSION,
  simulationConfigSchema,
} from "./config";
import {
  combatWeaponSchema,
  phase6SnapshotSchema,
  shopResultCodeSchema,
  weaponSlotSchema,
} from "./phase6";
import { gameModeSchema } from "./mode";

const id = z.string().min(1).max(128);
const counter = z.number().int().min(0).max(2147483647);
const time = z.number().finite().nonnegative();
const version = { v: z.literal(PROTOCOL_VERSION) };
export const vectorSchema = z
  .object({
    x: z.number().finite(),
    y: z.number().finite(),
    z: z.number().finite(),
  })
  .strict();
export type Vec3 = z.infer<typeof vectorSchema>;
export const lookSchema = {
  yaw: z.number().min(-Math.PI).max(Math.PI),
  pitch: z.number().min(-1.48).max(1.48),
};
export const inputSchema = z
  .object({
    ...version,
    type: z.literal("playerInput"),
    seq: counter,
    tick: counter,
    x: z.number().int().min(-1).max(1),
    z: z.number().int().min(-1).max(1),
    ...lookSchema,
    sprint: z.boolean(),
    jump: z.boolean(),
    crouch: z.boolean(),
  })
  .strict();
export type PlayerInput = z.infer<typeof inputSchema>;
export const clientMessageSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...version,
      type: z.literal("join"),
      token: z.string().min(30).max(3500),
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("clientReady"),
      mapId: z.literal(MAP_ID),
      mapVersion: z.literal(MAP_VERSION),
    })
    .strict(),
  inputSchema,
  z
    .object({
      ...version,
      type: z.literal("fire"),
      triggerSeq: counter,
      seq: counter,
      tick: counter,
      viewTick: counter.optional(),
      ...lookSchema,
    })
    .strict(),
  z.object({ ...version, type: z.literal("reload"), seq: counter }).strict(),
  z
    .object({ ...version, type: z.literal("triggerRelease"), seq: counter })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("beginRevive"),
      targetId: id,
      seq: counter,
    })
    .strict(),
  z
    .object({ ...version, type: z.literal("cancelRevive"), seq: counter })
    .strict(),
  z.object({ ...version, type: z.literal("leaveMatch") }).strict(),
  z.object({ ...version, type: z.literal("ping"), sentAt: time }).strict(),
  z
    .object({
      ...version,
      type: z.literal("purchaseWeapon"),
      requestId: id,
      weaponId: id,
      replaceWeaponId: id.optional(),
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("purchaseAmmo"),
      requestId: id,
      weaponId: id.optional(),
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("purchaseUpgrade"),
      requestId: id,
      upgradeId: id,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.enum([
        "purchaseArmor",
        "purchaseMedkit",
        "purchaseGrenade",
        "purchaseDeployable",
      ]),
      requestId: id,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("equipWeapon"),
      requestId: id,
      weaponId: id,
      slot: weaponSlotSchema,
      seq: counter,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("unlockGate"),
      requestId: id,
      gateId: id,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("beginObjectiveInteraction"),
      requestId: id,
      objectiveId: id,
    })
    .strict(),
]);
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export const matchStateSchema = z.enum([
  "BOOTSTRAPPING",
  "WAITING_FOR_PLAYERS",
  "LOADING",
  "COUNTDOWN",
  "PLAYING",
  "RECONNECTING",
  "BOSS_INTRO",
  "BOSS_ACTIVE",
  "CANCELLED",
  "ENDED",
  "ERROR",
]);
export type MatchState = z.infer<typeof matchStateSchema>;
export const weaponSchema = combatWeaponSchema;
export type WeaponState = z.infer<typeof weaponSchema>;
export const motionSchema = z
  .object({
    position: vectorSchema,
    velocity: vectorSchema,
    ...lookSchema,
    grounded: z.boolean(),
    crouched: z.boolean(),
    sprinting: z.boolean(),
  })
  .strict();
export type MotionState = z.infer<typeof motionSchema>;
export const playerSchema = motionSchema
  .extend({
    id,
    slot: z.union([z.literal(0), z.literal(1)]),
    name: z.string().max(64),
    connected: z.boolean(),
    ready: z.boolean(),
    lastInput: counter,
    health: counter,
    ...lifeFields,
    weapon: weaponSchema,
  })
  .strict();
export type PlayerState = z.infer<typeof playerSchema>;
export const targetSchema = z
  .object({ id, health: counter, resetAt: time })
  .strict();
export type TargetState = z.infer<typeof targetSchema>;
export const snapshotSchema = z
  .object({
    tick: counter,
    time,
    state: matchStateSchema,
    startAt: time,
    players: z.array(playerSchema).max(2),
    targets: z.array(targetSchema).max(8),
    pve: pveSnapshotSchema,
    phase6: phase6SnapshotSchema.optional(),
  })
  .strict();
export type WorldSnapshot = z.infer<typeof snapshotSchema>;
export const errorCodeSchema = z.enum([
  "INVALID_MESSAGE",
  "PROTOCOL_MISMATCH",
  "UNAUTHORIZED",
  "TOKEN_EXPIRED",
  "TOKEN_USED",
  "SLOT_CONNECTED",
  "MATCH_UNAVAILABLE",
  "RATE_LIMITED",
  "INPUT_WINDOW",
  "NOT_PLAYING",
  "FIRE_RATE",
  "EMPTY",
  "RELOADING",
  "INVALID_RELOAD",
  "SHOT_SEQUENCE",
  "SERVER_UNAVAILABLE",
]);
export type GameErrorCode = z.infer<typeof errorCodeSchema>;
export class GameError extends Error {
  constructor(public readonly code: GameErrorCode) {
    super(code);
    this.name = "GameError";
  }
}
export const serverMessageSchema = z.discriminatedUnion("type", [
  z
    .object({ ...version, type: z.literal("pveEvent"), event: pveEventSchema })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("waveStateChanged"),
      wave: waveSchema,
      seq: counter,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("welcome"),
      playerId: id,
      matchId: id,
      mode: gameModeSchema.optional(),
      slot: z.union([z.literal(0), z.literal(1)]),
      mapId: z.literal(MAP_ID),
      mapVersion: z.literal(MAP_VERSION),
      config: simulationConfigSchema,
      snapshot: snapshotSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("worldSnapshot"),
      snapshot: snapshotSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("matchState"),
      state: matchStateSchema,
      startAt: time,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("movementCorrection"),
      player: playerSchema,
      tick: counter,
      code: z.literal("INPUT_WINDOW"),
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("shotConfirmed"),
      weaponId: id,
      playerId: id,
      seq: counter,
      origin: vectorSchema,
      point: vectorSchema,
      targetId: id.nullable(),
      zombieHit: z
        .object({
          id,
          revision: counter,
          region: z.enum(["head", "body"]),
          killed: z.boolean(),
        })
        .strict()
        .optional(),
      weapon: weaponSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("shotRejected"),
      weaponId: id,
      seq: counter,
      code: errorCodeSchema,
      weapon: weaponSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("weaponState"),
      weaponId: id,
      playerId: id,
      weapon: weaponSchema,
      event: z.enum(["reloadStarted", "reloadCompleted", "unchanged"]),
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("shopResult"),
      requestId: id,
      code: shopResultCodeSchema,
      snapshot: phase6SnapshotSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("phase6State"),
      snapshot: phase6SnapshotSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("connectionWarning"),
      code: errorCodeSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("serverError"),
      code: errorCodeSchema,
    })
    .strict(),
  z
    .object({
      ...version,
      type: z.literal("pong"),
      sentAt: time,
      serverTime: time,
    })
    .strict(),
]);
export type ServerMessage = z.infer<typeof serverMessageSchema>;
export const participantSchema = z
  .object({
    userId: id,
    playerId: id,
    name: z.string().min(1).max(64),
    kind: z.enum(["USER", "GUEST"]),
    slot: z.union([z.literal(0), z.literal(1)]),
  })
  .strict();
const reservationFields = {
  matchId: id,
  roomId: id,
  runtimeId: id,
  serverEpoch: id,
  createdAt: time,
};
export const reservationSchema = z
  .union([
    z
      .object({
        ...reservationFields,
        mode: z.literal("solo"),
        players: z.tuple([participantSchema]),
      })
      .strict(),
    z
      .object({
        ...reservationFields,
        mode: z.literal("coop").optional(),
        players: z.tuple([participantSchema, participantSchema]),
      })
      .strict(),
  ])
  .refine(
    (r) =>
      r.players.length === (r.mode === "solo" ? 1 : 2) &&
      r.players.every((p, i) => p.slot === i) &&
      new Set(r.players.map((p) => p.userId)).size === r.players.length &&
      new Set(r.players.map((p) => p.playerId)).size === r.players.length,
  );
type Participant = z.infer<typeof participantSchema>;
type IndexedPlayers = { readonly [index: number]: Participant };
type SoloReservation = {
  mode: "solo";
  players: [Participant] & IndexedPlayers;
  matchId: string;
  roomId: string;
  runtimeId: string;
  serverEpoch: string;
  createdAt: number;
};
type CoopReservation = {
  mode?: "coop";
  players: [Participant, Participant] & IndexedPlayers;
  matchId: string;
  roomId: string;
  runtimeId: string;
  serverEpoch: string;
  createdAt: number;
};
export type Reservation = SoloReservation | CoopReservation;
export function neutralInput(
  seq = 0,
  tick = 0,
  yaw = 0,
  pitch = 0,
): PlayerInput {
  return {
    v: PROTOCOL_VERSION,
    type: "playerInput",
    seq,
    tick,
    x: 0,
    z: 0,
    yaw,
    pitch,
    sprint: false,
    jump: false,
    crouch: false,
  };
}
export function parseClientMessage(raw: string): ClientMessage {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new GameError("INVALID_MESSAGE");
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "v" in value &&
    value.v !== PROTOCOL_VERSION
  )
    throw new GameError("PROTOCOL_MISMATCH");
  const parsed = clientMessageSchema.safeParse(value);
  if (!parsed.success) throw new GameError("INVALID_MESSAGE");
  return parsed.data;
}
