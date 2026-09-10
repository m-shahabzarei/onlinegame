import type {
  CreateMatchSessionCommand,
  CreateRoomCommand,
  DisconnectCommand,
  JoinRoomCommand,
  LeaveRoomCommand,
  MatchSessionConnection,
  PlayerPresence,
  PresenceQuery,
  RealtimeRoomSession,
  ReconnectCommand,
  RoomEventListener,
  Unsubscribe,
} from "./contracts";
import type { RoomId } from "../domain";

/** Phase 1 allocation boundary. Phase 3 refines it into the focused interfaces in lobby-contracts.ts. */
export interface RealtimeGateway {
  createRoom(command: CreateRoomCommand): Promise<RealtimeRoomSession>;
  joinRoom(command: JoinRoomCommand): Promise<RealtimeRoomSession>;
  leaveRoom(command: LeaveRoomCommand): Promise<void>;
  subscribeToRoom(roomId: RoomId, listener: RoomEventListener): Unsubscribe;
  getPresence(query: PresenceQuery): Promise<readonly PlayerPresence[]>;
  createMatchSession(
    command: CreateMatchSessionCommand,
  ): Promise<MatchSessionConnection>;
  disconnect(command: DisconnectCommand): Promise<void>;
  reconnect(command: ReconnectCommand): Promise<RealtimeRoomSession>;
}

export class RealtimeUnavailableError extends Error {
  readonly code = "REALTIME_UNAVAILABLE";

  constructor(
    message = "A real-time provider has not been configured for this environment.",
  ) {
    super(message);
    this.name = "RealtimeUnavailableError";
  }
}
