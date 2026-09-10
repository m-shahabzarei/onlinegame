import { z } from "zod";
import type { ConnectionState } from "@/realtime/contracts";
import type { RoomVisibility } from "./room";
import { gameModeSchema, type GameMode } from "@/game/shared/mode";

export const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTVWXYZ23456789";
export const normalizeRoomCode = (code: string) =>
  code
    .trim()
    .replace(/[\s-]+/g, "")
    .toUpperCase();
export const inviteCodeSchema = z
  .string()
  .max(32)
  .transform(normalizeRoomCode)
  .pipe(
    z
      .string()
      .regex(
        /^[A-HJKMNP-TVWXYZ2-9]{8}$/,
        "Enter the eight-character room code.",
      ),
  );
export const LEASE_MS = 45_000;
export const HOST_GRACE_MS = 30_000;
export const ROOM_TTL_MS = 2 * 60 * 60 * 1000;
export type LobbyStatus =
  "WAITING" | "STARTING" | "IN_MATCH" | "CLOSED" | "EXPIRED";
export { gameModeSchema } from "@/game/shared/mode";
export type { GameMode } from "@/game/shared/mode";
export interface LobbyIdentity {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
}
export interface LobbyGame {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  maxPlayers: number;
}
export interface StoredMember {
  user: LobbyIdentity;
  role: "HOST" | "PLAYER";
  ready: boolean;
  joinedAt: number;
  updatedAt: number;
  removedAt: number | null;
  removalReason: "LEFT" | "KICKED" | "DISCONNECTED" | null;
}
export interface Receipt {
  key: string;
  fingerprint: string;
}
export interface RoomAggregate {
  id: string;
  code: string;
  game: LobbyGame;
  hostUserId: string;
  visibility: RoomVisibility;
  status: LobbyStatus;
  maxPlayers: number;
  mode?: GameMode;
  stateVersion: number;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  creationKey: string;
  members: StoredMember[];
  receipts: Receipt[];
  matchId: string | null;
  matchRuntime?: {
    reservation: import("../game/shared/protocol").Reservation;
    state: import("../game/shared/protocol").MatchState;
    leaseUntil: number;
    observedAt: number;
  };
}
export interface LobbyMember {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isGuest: boolean;
  role: "HOST" | "PLAYER";
  ready: boolean;
  connection: ConnectionState;
}
export interface LobbySnapshot {
  code: string;
  game: Pick<LobbyGame, "slug" | "name" | "description">;
  visibility: RoomVisibility;
  status: LobbyStatus;
  maxPlayers: number;
  mode?: GameMode;
  stateVersion: number;
  observedAt: number;
  expiresAt: number;
  members: LobbyMember[];
  selfId: string;
  matchId: string | null;
  startBlocker: string | null;
}
export interface PublicRoom {
  code: string;
  gameName: string;
  occupancy: number;
  maxPlayers: number;
  mode?: GameMode;
  readyCount: number;
  host: Omit<LobbyIdentity, "id">;
  createdAt: number;
  status: "WAITING";
}
export interface PresenceSummary {
  online: number;
  inLobby: number;
  inGame: number;
}
const base = { requestId: z.uuid() };
const memberCommand = {
  ...base,
  code: inviteCodeSchema,
  expectedVersion: z.number().int().nonnegative(),
};
export const lobbyCommandSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("create"),
      slug: z
        .string()
        .min(1)
        .max(64)
        .regex(/^[a-z0-9-]+$/),
      visibility: z.enum(["PUBLIC", "PRIVATE"]),
      mode: gameModeSchema.optional(),
    })
    .strict(),
  z
    .object({ ...base, type: z.literal("join"), code: inviteCodeSchema })
    .strict(),
  z
    .object({ ...memberCommand, type: z.literal("ready"), ready: z.boolean() })
    .strict(),
  z.object({ ...memberCommand, type: z.literal("leave") }).strict(),
  z.object({ ...memberCommand, type: z.literal("close") }).strict(),
  z
    .object({
      ...memberCommand,
      type: z.literal("kick"),
      targetUserId: z.string().min(1).max(128),
    })
    .strict(),
  z.object({ ...memberCommand, type: z.literal("start") }).strict(),
  z
    .object({
      ...memberCommand,
      type: z.literal("cancel"),
      matchId: z.string().min(1).max(128),
    })
    .strict(),
]);
export type LobbyCommand = z.infer<typeof lobbyCommandSchema>;
export type CommandResult = { room: LobbySnapshot | null; code: string };
export const LOBBY_ERRORS = {
  INVALID_INPUT: [400, "INVALID_INPUT"],
  UNAUTHENTICATED: [401, "UNAUTHENTICATED"],
  FORBIDDEN: [403, "FORBIDDEN"],
  ROOM_UNAVAILABLE: [404, "ROOM_UNAVAILABLE"],
  ROOM_FULL: [409, "ROOM_FULL"],
  ROOM_CLOSED: [410, "ROOM_CLOSED"],
  ROOM_EXPIRED: [410, "ROOM_EXPIRED"],
  ROOM_KICKED: [403, "ROOM_KICKED"],
  MEMBERSHIP_ENDED: [410, "MEMBERSHIP_ENDED"],
  ALREADY_IN_ROOM: [409, "ALREADY_IN_ROOM"],
  GAME_UNAVAILABLE: [409, "GAME_UNAVAILABLE"],
  INVALID_TRANSITION: [409, "INVALID_TRANSITION"],
  NOT_READY: [409, "NOT_READY"],
  STALE_STATE: [409, "STALE_STATE"],
  IDEMPOTENCY_CONFLICT: [409, "IDEMPOTENCY_CONFLICT"],
  RATE_LIMITED: [429, "RATE_LIMITED"],
  SERVICE_UNAVAILABLE: [503, "SERVICE_UNAVAILABLE"],
} as const;
export type LobbyErrorCode = keyof typeof LOBBY_ERRORS;
export class LobbyError extends Error {
  constructor(public readonly code: LobbyErrorCode) {
    super(LOBBY_ERRORS[code][1]);
    this.name = "LobbyError";
  }
}
export function lobbyErrorResponse(error: unknown) {
  const code = error instanceof LobbyError ? error.code : "SERVICE_UNAVAILABLE";
  return {
    status: LOBBY_ERRORS[code][0],
    error: { code, message: LOBBY_ERRORS[code][1] },
  };
}
export const activeMembers = (room: RoomAggregate) =>
  room.members.filter((m) => m.removedAt === null);
export function eligibleGame(game: LobbyGame | null): game is LobbyGame {
  return (
    !!game &&
    game.slug === "nightfall-protocol" &&
    game.status === "ACTIVE" &&
    game.maxPlayers >= 1 &&
    game.maxPlayers <= 2
  );
}
export function memberConnection(
  lastSeen: number | null,
  joinedAt: number,
  now: number,
): ConnectionState {
  const age = now - (lastSeen ?? joinedAt);
  if (lastSeen !== null && age < LEASE_MS) return "CONNECTED";
  return age < LEASE_MS + HOST_GRACE_MS ? "RECONNECTING" : "DISCONNECTED";
}
export function chooseHost(members: StoredMember[]): StoredMember | undefined {
  return [...members].sort(
    (a, b) =>
      a.joinedAt - b.joinedAt ||
      (a.user.id < b.user.id ? -1 : a.user.id > b.user.id ? 1 : 0),
  )[0];
}
export function startBlocker(
  members: LobbyMember[],
  maxPlayers: number,
): string | null {
  if (maxPlayers > 1 && members.length !== maxPlayers) return "INVITE_PLAYER";
  if (members.some((m) => m.connection !== "CONNECTED"))
    return "WAITING_FOR_CONNECTION";
  if (members.some((m) => !m.ready)) return "READY_REQUIRED";
  return null;
}
export function reconcileSnapshot(
  current: LobbySnapshot | null,
  next: LobbySnapshot,
): LobbySnapshot {
  if (!current || current.code !== next.code) return next;
  if (
    next.stateVersion < current.stateVersion ||
    (next.stateVersion === current.stateVersion &&
      next.observedAt < current.observedAt)
  )
    return current;
  return next;
}
