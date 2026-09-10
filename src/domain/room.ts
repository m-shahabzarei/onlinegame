import { z } from "zod";

import type { GameId } from "./game";
import type { UserId } from "./user";

export type RoomId = string;

export const ROOM_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
export type RoomVisibility = (typeof ROOM_VISIBILITIES)[number];

export const ROOM_STATUSES = [
  "WAITING",
  "STARTING",
  "IN_MATCH",
  "CLOSED",
  "EXPIRED",
] as const;
export type RoomStatus = (typeof ROOM_STATUSES)[number];

export const ROOM_MEMBER_ROLES = ["HOST", "PLAYER"] as const;
export type RoomMemberRole = (typeof ROOM_MEMBER_ROLES)[number];

export const roomCodeSchema = z
  .string()
  .regex(
    /^[A-Z0-9]{6,12}$/,
    "Room code must contain 6 to 12 uppercase letters or numbers.",
  );

export const playerCapacitySchema = z
  .number()
  .int("Player capacity must be a whole number.")
  .min(2, "Player capacity cannot be less than 2.")
  .max(4, "Player capacity cannot be greater than 4.");

export const roomFoundationSchema = z.object({
  code: roomCodeSchema,
  maxPlayers: playerCapacitySchema,
});

export type RoomFoundation = z.infer<typeof roomFoundationSchema>;

export interface Room {
  readonly id: RoomId;
  readonly code: string;
  readonly gameId: GameId;
  readonly hostUserId: UserId;
  readonly visibility: RoomVisibility;
  readonly status: RoomStatus;
  readonly maxPlayers: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly expiresAt: Date;
}

export interface RoomMember {
  readonly roomId: RoomId;
  readonly userId: UserId;
  readonly role: RoomMemberRole;
  readonly ready: boolean;
  readonly joinedAt: Date;
  readonly updatedAt: Date;
}
