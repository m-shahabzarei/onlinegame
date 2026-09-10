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
  INVALID_INPUT: [400, "Check the room code and form fields."],
  UNAUTHENTICATED: [
    401,
    "Your session has ended. Sign in or continue as a guest.",
  ],
  FORBIDDEN: [403, "You cannot perform this room action."],
  ROOM_UNAVAILABLE: [
    404,
    "This invite is unavailable. Check the code, or ask the host for a new invite.",
  ],
  ROOM_FULL: [409, "This room is full. Choose another room or create one."],
  ROOM_CLOSED: [410, "This room is closed."],
  ROOM_EXPIRED: [410, "This room has expired. Create a new room."],
  ROOM_KICKED: [403, "The host removed you from this room."],
  MEMBERSHIP_ENDED: [
    410,
    "Your room membership ended. You can join again if a slot is available.",
  ],
  ALREADY_IN_ROOM: [
    409,
    "You already belong to another room. Return to it and leave before joining another.",
  ],
  GAME_UNAVAILABLE: [409, "Room preparation is unavailable for this game."],
  INVALID_TRANSITION: [
    409,
    "This action is unavailable in the room’s current state.",
  ],
  NOT_READY: [
    409,
    "Two connected, ready players are required to prepare this session.",
  ],
  STALE_STATE: [
    409,
    "The room changed. The latest state has been loaded; try your action again.",
  ],
  IDEMPOTENCY_CONFLICT: [
    409,
    "This request key was already used for a different action.",
  ],
  RATE_LIMITED: [429, "Too many attempts. Wait a minute and try again."],
  SERVICE_UNAVAILABLE: [
    503,
    "The room service is temporarily unavailable. Your input has been kept; retry shortly.",
  ],
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
  if (maxPlayers > 1 && members.length !== maxPlayers)
    return maxPlayers === 1
      ? null
      : `Invite another player (${members.length}/${maxPlayers} slots filled).`;
  if (members.some((m) => m.connection !== "CONNECTED"))
    return maxPlayers === 1
      ? "Waiting for you to connect."
      : "Waiting for both players to connect.";
  if (members.some((m) => !m.ready))
    return maxPlayers === 1
      ? "You must be Ready."
      : "Both players must be Ready.";
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
