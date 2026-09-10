import type { RoomId } from "../domain";
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
import {
  RealtimeUnavailableError,
  type RealtimeGateway,
} from "./realtime-gateway";

const DEFAULT_UNAVAILABLE_MESSAGE =
  "A real-time provider has not been configured for this environment.";

/**
 * Explicit Phase 1 placeholder. It preserves the provider boundary without
 * simulating room, presence, matchmaking, or gameplay behavior.
 */
export class UnconfiguredRealtimeGateway implements RealtimeGateway {
  constructor(private readonly message = DEFAULT_UNAVAILABLE_MESSAGE) {}

  createRoom(command: CreateRoomCommand): Promise<RealtimeRoomSession> {
    void command;
    return this.rejectUnavailable();
  }

  joinRoom(command: JoinRoomCommand): Promise<RealtimeRoomSession> {
    void command;
    return this.rejectUnavailable();
  }

  leaveRoom(command: LeaveRoomCommand): Promise<void> {
    void command;
    return this.rejectUnavailable();
  }

  subscribeToRoom(roomId: RoomId, listener: RoomEventListener): Unsubscribe {
    void roomId;
    void listener;
    return () => undefined;
  }

  getPresence(query: PresenceQuery): Promise<readonly PlayerPresence[]> {
    void query;
    return this.rejectUnavailable();
  }

  createMatchSession(
    command: CreateMatchSessionCommand,
  ): Promise<MatchSessionConnection> {
    void command;
    return this.rejectUnavailable();
  }

  disconnect(command: DisconnectCommand): Promise<void> {
    void command;
    return this.rejectUnavailable();
  }

  reconnect(command: ReconnectCommand): Promise<RealtimeRoomSession> {
    void command;
    return this.rejectUnavailable();
  }

  private rejectUnavailable<T>(): Promise<T> {
    return Promise.reject(new RealtimeUnavailableError(this.message));
  }
}

export const unconfiguredRealtimeGateway: RealtimeGateway =
  new UnconfiguredRealtimeGateway();
