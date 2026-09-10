import type {
  CommandResult,
  LobbyCommand,
  LobbyIdentity,
  LobbySnapshot,
  PresenceSummary,
  PublicRoom,
} from "@/domain/lobby";
import type { ConnectionState, Unsubscribe } from "./contracts";
export type { RoomStateStore } from "@/server/lobby/store";

export interface PresenceService {
  heartbeat(userId: string, roomId: string | null): Promise<void>;
  lastSeen(
    roomId: string,
    userIds: string[],
  ): Promise<Record<string, number | null>>;
  summary(): Promise<PresenceSummary>;
}
export interface RealtimePublisher {
  publish(channel: string, revision: number): Promise<void>;
}
export interface SubscriptionTicket {
  mode: "local" | "ably";
  channel: string;
  token?: string;
}
export interface RealtimeSubscriber {
  subscribe(
    ticket: SubscriptionTicket,
    invalidate: () => void,
    status: (state: ConnectionState) => void,
  ): Unsubscribe;
}
export interface ConnectionManager {
  connect(): void;
  disconnect(): void;
  retry(): void;
}
export interface RoomService {
  execute(identity: LobbyIdentity, input: LobbyCommand): Promise<CommandResult>;
  snapshot(userId: string, code: string): Promise<LobbySnapshot>;
  list(slug: string): Promise<PublicRoom[]>;
}
export interface MatchSessionService {
  reserve(): string;
}
