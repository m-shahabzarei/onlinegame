import type {
  GameId,
  MatchId,
  RoomId,
  RoomMemberRole,
  RoomStatus,
  UserId,
} from "../domain";

export type IsoDateString = string;
export type Unsubscribe = () => void;

export type JsonPrimitive = boolean | number | string | null;
export type JsonValue =
  JsonPrimitive | { readonly [key: string]: JsonValue } | readonly JsonValue[];

export const CONNECTION_STATES = [
  "DISCONNECTED",
  "CONNECTING",
  "CONNECTED",
  "RECONNECTING",
  "FAILED",
] as const;
export type ConnectionState = (typeof CONNECTION_STATES)[number];

export const PRESENCE_STATES = [
  "ONLINE",
  "AWAY",
  "IN_LOBBY",
  "IN_GAME",
  "OFFLINE",
] as const;
export type PresenceState = (typeof PRESENCE_STATES)[number];

export interface RealtimeRoomMemberSnapshot {
  readonly userId: UserId;
  readonly role: RoomMemberRole;
  readonly ready: boolean;
  readonly connectionState: ConnectionState;
}

export interface RealtimeRoomSnapshot {
  readonly roomId: RoomId;
  readonly gameId: GameId;
  readonly status: RoomStatus;
  readonly maxPlayers: number;
  readonly revision: number;
  readonly members: readonly RealtimeRoomMemberSnapshot[];
  readonly updatedAt: IsoDateString;
}

export interface RealtimeEventEnvelope<TPayload extends JsonValue = JsonValue> {
  readonly eventId: string;
  readonly roomId: RoomId;
  readonly type: string;
  readonly revision: number;
  readonly occurredAt: IsoDateString;
  readonly payload: TPayload;
}

export type RoomEventListener = (event: RealtimeEventEnvelope) => void;

export interface PlayerPresence {
  readonly userId: UserId;
  readonly state: PresenceState;
  readonly roomId: RoomId | null;
  readonly connectionId: string | null;
  readonly observedAt: IsoDateString;
}

export interface RealtimeRoomSession {
  readonly connectionId: string;
  readonly reconnectToken: string;
  readonly room: RealtimeRoomSnapshot;
}

export interface CreateRoomCommand {
  readonly roomId: RoomId;
  readonly gameId: GameId;
  readonly hostUserId: UserId;
  readonly maxPlayers: number;
}

export interface JoinRoomCommand {
  readonly roomId: RoomId;
  readonly userId: UserId;
}

export interface LeaveRoomCommand {
  readonly roomId: RoomId;
  readonly userId: UserId;
  readonly connectionId: string;
}

export interface PresenceQuery {
  readonly roomId?: RoomId;
  readonly userIds?: readonly UserId[];
}

export interface CreateMatchSessionCommand {
  readonly matchId: MatchId;
  readonly roomId: RoomId;
  readonly gameId: GameId;
  readonly playerIds: readonly UserId[];
}

export interface MatchSessionConnection {
  readonly matchId: MatchId;
  readonly sessionId: string;
  readonly endpoint: string;
  readonly connectionToken: string;
  readonly expiresAt: IsoDateString;
}

export interface DisconnectCommand {
  readonly connectionId: string;
}

export interface ReconnectCommand {
  readonly reconnectToken: string;
}
