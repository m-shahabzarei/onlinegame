import { z } from "zod";

export type UserId = string;

export const usernameSchema = z
  .string()
  .min(3, "Username must contain at least 3 characters.")
  .max(32, "Username must contain at most 32 characters.")
  .regex(
    /^[A-Za-z0-9_]+$/,
    "Username may contain only letters, numbers, and underscores.",
  );

export interface User {
  readonly id: UserId;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly email: string | null;
  readonly isGuest: boolean;
  readonly bio: string | null;
  readonly locale: string | null;
  readonly reducedMotion: boolean;
  readonly soundEnabled: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
