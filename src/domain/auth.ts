import { z } from "zod";

import { usernameSchema } from "./user";

export const sessionKindSchema = z.enum(["USER", "GUEST"]);
export type SessionKind = z.infer<typeof sessionKindSchema>;

const emailSchema = z
  .string()
  .trim()
  .email("Enter a valid email address.")
  .max(320, "Email must contain at most 320 characters.")
  .transform((value) => value.toLowerCase());

export const passwordSchema = z
  .string()
  .min(8, "Password must contain at least 8 characters.")
  .max(128, "Password must contain at most 128 characters.");

export const registrationInputSchema = z
  .object({
    email: emailSchema,
    username: usernameSchema,
    displayName: z
      .string()
      .trim()
      .min(1, "Display name is required.")
      .max(64, "Display name must contain at most 64 characters."),
    password: passwordSchema,
    passwordConfirmation: z.string(),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
    message: "Passwords do not match.",
  });

/**
 * Login accepts the canonical `identifier` field. For progressively enhanced
 * forms, `email` and `username` aliases are accepted and normalized server-side.
 */
export const loginInputSchema = z.preprocess(
  (value) => {
    if (!value || typeof value !== "object") return value;

    const record = value as Record<string, unknown>;
    const identifier =
      record.identifier ?? record.email ?? record.username ?? undefined;

    return { ...record, identifier };
  },
  z.object({
    identifier: z.string().trim().min(3, "Enter your email or username."),
    password: passwordSchema,
    remember: z.preprocess((value) => {
      if (value === undefined || value === null || value === "") return true;
      if (
        value === true ||
        value === "true" ||
        value === "on" ||
        value === "1"
      ) {
        return true;
      }
      if (value === false || value === "false" || value === "0") return false;
      return value;
    }, z.boolean().default(true)),
  }),
);

export type RegistrationInput = z.infer<typeof registrationInputSchema>;
export type LoginInput = z.infer<typeof loginInputSchema>;

export interface SafeUser {
  readonly id: string;
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

export interface AuthSession {
  readonly id: string;
  readonly userId: string;
  readonly kind: SessionKind;
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly user: SafeUser;
}

export interface GuestSession extends AuthSession {
  readonly kind: "GUEST";
  readonly user: SafeUser & { readonly isGuest: true };
}

export type AuthSuccess = {
  readonly user: SafeUser;
  readonly session: AuthSession;
  /** Raw opaque token. It must only ever be written to an HTTP-only cookie. */
  readonly token: string;
  /** Whether the browser cookie should persist beyond the current tab/session. */
  readonly persistent: boolean;
};

export type AuthErrorCode =
  | "INVALID_INPUT"
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_EXISTS"
  | "USERNAME_TAKEN"
  | "AUTH_UNAVAILABLE"
  | "UNAUTHENTICATED"
  | "SESSION_EXPIRED"
  | "SESSION_INVALID"
  | "USER_NOT_FOUND"
  | "INTERNAL_ERROR";

export interface AuthError {
  readonly code: AuthErrorCode;
  readonly message: string;
  readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
}

export type AuthResult<T = AuthSuccess> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: AuthError };

export type ActionResult<T = AuthSuccess> = AuthResult<T>;

export function normalizeIdentifier(identifier: string): string {
  return identifier.trim().toLowerCase();
}
