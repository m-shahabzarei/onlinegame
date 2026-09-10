import "server-only";

import { randomUUID } from "node:crypto";

import {
  loginInputSchema,
  normalizeIdentifier,
  profileUpdateSchema,
  registrationInputSchema,
  settingsUpdateSchema,
  type AuthError,
  type AuthResult,
  type AuthSession,
  type AuthSuccess,
  type SafeUser,
} from "@/domain";
import { getServerEnv } from "@/config/server-env";
import { prisma } from "@/db/client";

import { hashPassword, verifyPassword } from "./password";
import {
  hashSessionToken,
  issueSessionToken,
  type IssuedSessionToken,
} from "./session";

export interface AuthUserRecord extends SafeUser {
  readonly passwordHash: string | null;
}

export interface AuthSessionRecord {
  readonly id: string;
  readonly tokenHash: string;
  readonly userId: string;
  readonly kind: "USER" | "GUEST";
  readonly expiresAt: Date;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly user: AuthUserRecord;
}

export interface CreateUserRecord {
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl?: string | null;
  readonly email?: string | null;
  readonly passwordHash?: string | null;
  readonly isGuest?: boolean;
  readonly bio?: string | null;
  readonly locale?: string | null;
  readonly reducedMotion?: boolean;
  readonly soundEnabled?: boolean;
}

export interface UpdateUserRecord {
  readonly username?: string;
  readonly displayName?: string;
  readonly avatarUrl?: string | null;
  readonly bio?: string | null;
  readonly locale?: string | null;
  readonly reducedMotion?: boolean;
  readonly soundEnabled?: boolean;
}

export interface CreateSessionRecord {
  readonly tokenHash: string;
  readonly userId: string;
  readonly kind: "USER" | "GUEST";
  readonly expiresAt: Date;
}

export interface CreateUserWithSessionRecord {
  readonly user: CreateUserRecord;
  readonly session: Omit<CreateSessionRecord, "userId">;
}

/** Persistence boundary. Implementations can be swapped for another auth provider. */
export interface AuthRepository {
  findUserByEmail(email: string): Promise<AuthUserRecord | null>;
  findUserByUsername(username: string): Promise<AuthUserRecord | null>;
  createUser(input: CreateUserRecord): Promise<AuthUserRecord>;
  /** Persist a new identity and its initial session as one atomic operation. */
  createUserWithSession(
    input: CreateUserWithSessionRecord,
  ): Promise<AuthSessionRecord>;
  updateUser(userId: string, input: UpdateUserRecord): Promise<AuthUserRecord>;
  createSession(input: CreateSessionRecord): Promise<AuthSessionRecord>;
  findSessionByTokenHash(tokenHash: string): Promise<AuthSessionRecord | null>;
  deleteSessionByTokenHash(tokenHash: string): Promise<void>;
  deleteExpiredSessions(now: Date): Promise<void>;
  /** Remove a temporary guest only when it has no sessions or durable references. */
  deleteGuestUserIfUnreferenced?(userId: string): Promise<boolean>;
}

export class AuthRepositoryError extends Error {
  readonly code: "UNIQUE" | "NOT_FOUND" | "UNAVAILABLE";
  readonly target: readonly string[] | undefined;

  constructor(
    code: "UNIQUE" | "NOT_FOUND" | "UNAVAILABLE",
    message: string,
    target?: readonly string[],
  ) {
    super(message);
    this.name = "AuthRepositoryError";
    this.code = code;
    this.target = target;
  }
}

function mapUser(user: {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  email: string | null;
  passwordHash: string | null;
  isGuest: boolean;
  bio: string | null;
  locale: string | null;
  reducedMotion: boolean;
  soundEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): AuthUserRecord {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    passwordHash: user.passwordHash,
    isGuest: user.isGuest,
    bio: user.bio,
    locale: user.locale,
    reducedMotion: user.reducedMotion,
    soundEnabled: user.soundEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function mapSession(session: {
  id: string;
  tokenHash: string;
  userId: string;
  kind: "USER" | "GUEST";
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user: Parameters<typeof mapUser>[0];
}): AuthSessionRecord {
  return {
    id: session.id,
    tokenHash: session.tokenHash,
    userId: session.userId,
    kind: session.kind,
    expiresAt: session.expiresAt,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    user: mapUser(session.user),
  };
}

function mapRepositoryError(error: unknown): AuthRepositoryError {
  if (error instanceof AuthRepositoryError) return error;

  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  ) {
    const meta = (error as { meta?: { target?: unknown } }).meta;
    const target = Array.isArray(meta?.target)
      ? meta.target.filter((item): item is string => typeof item === "string")
      : undefined;
    return new AuthRepositoryError(
      "UNIQUE",
      "A unique value is already in use.",
      target,
    );
  }

  return new AuthRepositoryError(
    "UNAVAILABLE",
    "The account service is temporarily unavailable.",
  );
}

/** Prisma-backed repository used by the database auth mode. */
export class PrismaAuthRepository implements AuthRepository {
  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    try {
      const user = await prisma.user.findUnique({ where: { email } });
      return user ? mapUser(user) : null;
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    try {
      const user = await prisma.user.findUnique({ where: { username } });
      return user ? mapUser(user) : null;
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async createUser(input: CreateUserRecord): Promise<AuthUserRecord> {
    try {
      const user = await prisma.user.create({
        data: {
          username: input.username,
          displayName: input.displayName,
          avatarUrl: input.avatarUrl ?? null,
          email: input.email ?? null,
          passwordHash: input.passwordHash ?? null,
          isGuest: input.isGuest ?? false,
          bio: input.bio ?? null,
          locale: input.locale ?? null,
          reducedMotion: input.reducedMotion ?? false,
          soundEnabled: input.soundEnabled ?? true,
        },
      });
      return mapUser(user);
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async createUserWithSession(
    input: CreateUserWithSessionRecord,
  ): Promise<AuthSessionRecord> {
    try {
      const session = await prisma.$transaction(async (transaction) => {
        const user = await transaction.user.create({
          data: {
            username: input.user.username,
            displayName: input.user.displayName,
            avatarUrl: input.user.avatarUrl ?? null,
            email: input.user.email ?? null,
            passwordHash: input.user.passwordHash ?? null,
            isGuest: input.user.isGuest ?? false,
            bio: input.user.bio ?? null,
            locale: input.user.locale ?? null,
            reducedMotion: input.user.reducedMotion ?? false,
            soundEnabled: input.user.soundEnabled ?? true,
          },
        });

        return transaction.session.create({
          data: {
            tokenHash: input.session.tokenHash,
            userId: user.id,
            kind: input.session.kind,
            expiresAt: input.session.expiresAt,
          },
          include: { user: true },
        });
      });
      return mapSession(session);
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async updateUser(
    userId: string,
    input: UpdateUserRecord,
  ): Promise<AuthUserRecord> {
    try {
      const user = await prisma.user.update({
        where: { id: userId },
        data: input,
      });
      return mapUser(user);
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async createSession(input: CreateSessionRecord): Promise<AuthSessionRecord> {
    try {
      const session = await prisma.session.create({
        data: {
          tokenHash: input.tokenHash,
          userId: input.userId,
          kind: input.kind,
          expiresAt: input.expiresAt,
        },
        include: { user: true },
      });
      return mapSession(session);
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    try {
      const session = await prisma.session.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      return session ? mapSession(session) : null;
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    try {
      await prisma.session.deleteMany({ where: { tokenHash } });
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    try {
      const expiredGuestSessions = await prisma.session.findMany({
        where: { expiresAt: { lte: now }, kind: "GUEST" },
        select: { userId: true },
      });
      const guestUserIds = [
        ...new Set(expiredGuestSessions.map((session) => session.userId)),
      ];

      const deleteSessions = prisma.session.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      if (guestUserIds.length === 0) {
        await deleteSessions;
        return;
      }

      await prisma.$transaction([
        deleteSessions,
        prisma.user.deleteMany({
          where: {
            id: { in: guestUserIds },
            isGuest: true,
            sessions: { none: {} },
            hostedRooms: { none: {} },
            roomMemberships: { none: {} },
          },
        }),
      ]);
    } catch (error) {
      throw mapRepositoryError(error);
    }
  }

  async deleteGuestUserIfUnreferenced(userId: string): Promise<boolean> {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          isGuest: true,
          _count: {
            select: {
              sessions: true,
              hostedRooms: true,
              roomMemberships: true,
            },
          },
        },
      });
      if (
        !user ||
        !user.isGuest ||
        user._count.sessions > 0 ||
        user._count.hostedRooms > 0 ||
        user._count.roomMemberships > 0
      ) {
        return false;
      }

      await prisma.user.delete({ where: { id: userId } });
      return true;
    } catch (error) {
      // A concurrent room/member reference (or a missing row) means the guest
      // remains safely retained for a later cleanup job.
      if (error instanceof AuthRepositoryError && error.code === "NOT_FOUND") {
        return false;
      }
      return false;
    }
  }
}

/** Lightweight adapter for explicit development mode and deterministic tests. */
export interface InMemoryAuthStore {
  readonly users: Map<string, AuthUserRecord>;
  readonly sessions: Map<string, AuthSessionRecord>;
}

function createInMemoryAuthStore(): InMemoryAuthStore {
  return {
    users: new Map<string, AuthUserRecord>(),
    sessions: new Map<string, AuthSessionRecord>(),
  };
}

export class InMemoryAuthRepository implements AuthRepository {
  private readonly users: InMemoryAuthStore["users"];
  private readonly sessions: InMemoryAuthStore["sessions"];

  constructor(store: InMemoryAuthStore = createInMemoryAuthStore()) {
    this.users = store.users;
    this.sessions = store.sessions;
  }

  async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return (
      [...this.users.values()].find(
        (user) => user.email?.toLowerCase() === email.toLowerCase(),
      ) ?? null
    );
  }

  async findUserByUsername(username: string): Promise<AuthUserRecord | null> {
    return (
      [...this.users.values()].find(
        (user) => user.username.toLowerCase() === username.toLowerCase(),
      ) ?? null
    );
  }

  async createUser(input: CreateUserRecord): Promise<AuthUserRecord> {
    if (input.email && (await this.findUserByEmail(input.email))) {
      throw new AuthRepositoryError("UNIQUE", "Email is already in use.", [
        "email",
      ]);
    }
    if (await this.findUserByUsername(input.username)) {
      throw new AuthRepositoryError("UNIQUE", "Username is already in use.", [
        "username",
      ]);
    }

    const now = new Date();
    const user: AuthUserRecord = {
      id: `dev_${randomUUID()}`,
      username: input.username,
      displayName: input.displayName,
      avatarUrl: input.avatarUrl ?? null,
      email: input.email ?? null,
      passwordHash: input.passwordHash ?? null,
      isGuest: input.isGuest ?? false,
      bio: input.bio ?? null,
      locale: input.locale ?? null,
      reducedMotion: input.reducedMotion ?? false,
      soundEnabled: input.soundEnabled ?? true,
      createdAt: now,
      updatedAt: now,
    };
    this.users.set(user.id, user);
    return user;
  }

  async createUserWithSession(
    input: CreateUserWithSessionRecord,
  ): Promise<AuthSessionRecord> {
    let user: AuthUserRecord | undefined;
    try {
      user = await this.createUser(input.user);
      return await this.createSession({
        ...input.session,
        userId: user.id,
      });
    } catch (error) {
      if (user) {
        for (const [hash, session] of this.sessions) {
          if (session.userId === user.id) this.sessions.delete(hash);
        }
        this.users.delete(user.id);
      }
      throw error;
    }
  }

  async updateUser(
    userId: string,
    input: UpdateUserRecord,
  ): Promise<AuthUserRecord> {
    const current = this.users.get(userId);
    if (!current) throw new AuthRepositoryError("NOT_FOUND", "User not found.");

    if (
      input.username &&
      input.username.toLowerCase() !== current.username.toLowerCase()
    ) {
      const duplicate = await this.findUserByUsername(input.username);
      if (duplicate) {
        throw new AuthRepositoryError("UNIQUE", "Username is already in use.", [
          "username",
        ]);
      }
    }

    const user: AuthUserRecord = {
      ...current,
      ...input,
      updatedAt: new Date(),
    };
    this.users.set(userId, user);

    // Keep the user snapshot embedded in sessions current.
    for (const [hash, session] of this.sessions) {
      if (session.userId === userId)
        this.sessions.set(hash, { ...session, user });
    }
    return user;
  }

  async createSession(input: CreateSessionRecord): Promise<AuthSessionRecord> {
    if (this.sessions.has(input.tokenHash)) {
      throw new AuthRepositoryError(
        "UNIQUE",
        "Session token is already in use.",
        ["tokenHash"],
      );
    }

    const user = this.users.get(input.userId);
    if (!user) throw new AuthRepositoryError("NOT_FOUND", "User not found.");

    const now = new Date();
    const session: AuthSessionRecord = {
      id: `dev_session_${randomUUID()}`,
      tokenHash: input.tokenHash,
      userId: input.userId,
      kind: input.kind,
      expiresAt: input.expiresAt,
      createdAt: now,
      updatedAt: now,
      user,
    };
    this.sessions.set(input.tokenHash, session);
    return session;
  }

  async findSessionByTokenHash(
    tokenHash: string,
  ): Promise<AuthSessionRecord | null> {
    return this.sessions.get(tokenHash) ?? null;
  }

  async deleteSessionByTokenHash(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
  }

  async deleteExpiredSessions(now: Date): Promise<void> {
    const expiredGuestIds = new Set<string>();
    for (const [hash, session] of this.sessions) {
      if (session.expiresAt <= now) {
        if (session.kind === "GUEST") expiredGuestIds.add(session.userId);
        this.sessions.delete(hash);
      }
    }

    for (const userId of expiredGuestIds) {
      await this.deleteGuestUserIfUnreferenced(userId);
    }
  }

  async deleteGuestUserIfUnreferenced(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user || !user.isGuest) return false;

    const hasSession = [...this.sessions.values()].some(
      (session) => session.userId === userId,
    );
    if (hasSession) return false;

    this.users.delete(userId);
    return true;
  }
}

export interface AuthServiceOptions {
  readonly repository: AuthRepository;
  readonly sessionTtlDays?: number;
  readonly guestSessionTtlDays?: number;
  readonly nonPersistentSessionTtlDays?: number;
  readonly now?: () => Date;
  readonly tokenFactory?: () => string;
}

export class AuthServiceError extends Error {
  readonly code: "UNAUTHENTICATED" | "SESSION_EXPIRED" | "SESSION_INVALID";

  constructor(
    code: "UNAUTHENTICATED" | "SESSION_EXPIRED" | "SESSION_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "AuthServiceError";
    this.code = code;
  }
}

function errorResult(
  code: AuthError["code"],
  message: string,
  fieldErrors?: Readonly<Record<string, readonly string[]>>,
): AuthResult<never> {
  return {
    ok: false,
    error: fieldErrors ? { code, message, fieldErrors } : { code, message },
  };
}

function validationResult(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  const flattened = error.flatten();
  return errorResult(
    "INVALID_INPUT",
    "Check the highlighted fields.",
    flattened.fieldErrors,
  );
}

function toSafeUser(user: AuthUserRecord): SafeUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    email: user.email,
    isGuest: user.isGuest,
    bio: user.bio,
    locale: user.locale,
    reducedMotion: user.reducedMotion,
    soundEnabled: user.soundEnabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function toSession(record: AuthSessionRecord): AuthSession {
  return {
    id: record.id,
    userId: record.userId,
    kind: record.kind,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    user: toSafeUser(record.user),
  };
}

export class AuthService {
  private readonly repository: AuthRepository;
  private readonly sessionTtlDays: number;
  private readonly guestSessionTtlDays: number;
  private readonly nonPersistentSessionTtlDays: number;
  private readonly now: () => Date;
  private readonly tokenFactory: (() => string) | undefined;

  constructor(options: AuthServiceOptions) {
    this.repository = options.repository;
    this.sessionTtlDays = options.sessionTtlDays ?? 30;
    this.guestSessionTtlDays = options.guestSessionTtlDays ?? 1;
    this.nonPersistentSessionTtlDays = options.nonPersistentSessionTtlDays ?? 1;
    this.now = options.now ?? (() => new Date());
    this.tokenFactory = options.tokenFactory;
  }

  async register(input: unknown): Promise<AuthResult<AuthSuccess>> {
    const parsed = registrationInputSchema.safeParse(input);
    if (!parsed.success) return validationResult(parsed.error);

    const data = parsed.data;
    const username = data.username.toLowerCase();
    const email = data.email.toLowerCase();

    try {
      await this.repository.deleteExpiredSessions(this.now());
      if (await this.repository.findUserByEmail(email)) {
        return errorResult(
          "ACCOUNT_EXISTS",
          "An account with that email already exists.",
          {
            email: ["An account with that email already exists."],
          },
        );
      }
      if (await this.repository.findUserByUsername(username)) {
        return errorResult(
          "USERNAME_TAKEN",
          "That username is already in use.",
          {
            username: ["That username is already in use."],
          },
        );
      }

      const passwordHash = await hashPassword(data.password);
      return {
        ok: true,
        data: await this.createNewAuthenticatedSuccess(
          {
            email,
            username,
            displayName: data.displayName,
            passwordHash,
            isGuest: false,
          },
          "USER",
          true,
        ),
      };
    } catch (error) {
      return this.mapFailure(error);
    }
  }

  async login(input: unknown): Promise<AuthResult<AuthSuccess>> {
    const parsed = loginInputSchema.safeParse(input);
    if (!parsed.success) return validationResult(parsed.error);

    const identifier = normalizeIdentifier(parsed.data.identifier);

    try {
      await this.repository.deleteExpiredSessions(this.now());
      const user = identifier.includes("@")
        ? await this.repository.findUserByEmail(identifier)
        : await this.repository.findUserByUsername(identifier);

      let passwordMatches = false;
      if (user) {
        passwordMatches = await verifyPassword(
          parsed.data.password,
          user.passwordHash,
        );
      } else {
        // Keep unknown-account attempts on the same memory-hard path so the
        // generic error is not undermined by an obvious timing difference.
        await hashPassword(parsed.data.password);
      }

      if (!user || !passwordMatches) {
        return errorResult(
          "INVALID_CREDENTIALS",
          "Email/username or password is incorrect.",
        );
      }

      return this.createAuthenticatedResult(user, "USER", parsed.data.remember);
    } catch (error) {
      return this.mapFailure(error);
    }
  }

  async createGuestSession(): Promise<AuthResult<AuthSuccess>> {
    try {
      await this.repository.deleteExpiredSessions(this.now());
    } catch (error) {
      return this.mapFailure(error);
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const suffix = randomUUID()
        .replaceAll("-", "")
        .slice(0, 10)
        .toLowerCase();
      try {
        return {
          ok: true,
          data: await this.createNewAuthenticatedSuccess(
            {
              username: `guest_${suffix}`,
              displayName: "Guest",
              isGuest: true,
              passwordHash: null,
              email: null,
            },
            "GUEST",
            true,
          ),
        };
      } catch (error) {
        const mapped = mapRepositoryError(error);
        const canRetryUsernameCollision =
          mapped.code === "UNIQUE" &&
          (mapped.target === undefined || mapped.target.includes("username"));
        if (!canRetryUsernameCollision || attempt === 4)
          return this.mapFailure(mapped);
      }
    }

    return errorResult(
      "INTERNAL_ERROR",
      "We could not start a guest session. Try again.",
    );
  }

  async getCurrentSession(
    token: string | null | undefined,
  ): Promise<AuthSession | null> {
    try {
      return await this.getCurrentSessionStrict(token);
    } catch {
      return null;
    }
  }

  /** Resolve session state while preserving infrastructure failures for protected flows. */
  async getCurrentSessionStrict(
    token: string | null | undefined,
  ): Promise<AuthSession | null> {
    if (!token) return null;

    const tokenHash = hashSessionToken(token);
    const record = await this.repository.findSessionByTokenHash(tokenHash);
    if (!record) return null;
    if (record.expiresAt <= this.now()) {
      await this.repository.deleteSessionByTokenHash(tokenHash);
      await this.cleanupGuest(record);
      return null;
    }
    return toSession(record);
  }

  async logout(token: string | null | undefined): Promise<void> {
    if (!token) return;
    const tokenHash = hashSessionToken(token);
    const record = await this.repository.findSessionByTokenHash(tokenHash);
    await this.repository.deleteSessionByTokenHash(tokenHash);
    if (record) await this.cleanupGuest(record);
  }

  async requireUser(token: string | null | undefined): Promise<SafeUser> {
    const session = await this.getCurrentSessionStrict(token);
    if (!session) {
      throw new AuthServiceError(
        "UNAUTHENTICATED",
        "You need to sign in to continue.",
      );
    }
    return session.user;
  }

  async updateProfile(
    userId: string,
    input: unknown,
  ): Promise<AuthResult<{ readonly user: SafeUser }>> {
    const parsed = profileUpdateSchema.safeParse(input);
    if (!parsed.success) return validationResult(parsed.error);

    const data = parsed.data;
    try {
      const existing = await this.repository.findUserByUsername(
        data.username.toLowerCase(),
      );
      if (existing && existing.id !== userId) {
        return errorResult(
          "USERNAME_TAKEN",
          "That username is already in use.",
          {
            username: ["That username is already in use."],
          },
        );
      }

      const user = await this.repository.updateUser(userId, {
        username: data.username.toLowerCase(),
        displayName: data.displayName,
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.bio !== undefined ? { bio: data.bio } : {}),
      });
      return { ok: true, data: { user: toSafeUser(user) } };
    } catch (error) {
      return this.mapFailure(error);
    }
  }

  async updateSettings(
    userId: string,
    input: unknown,
  ): Promise<AuthResult<{ readonly user: SafeUser }>> {
    const parsed = settingsUpdateSchema.safeParse(input);
    if (!parsed.success) return validationResult(parsed.error);

    try {
      const data = parsed.data;
      const user = await this.repository.updateUser(userId, {
        ...(data.displayName !== undefined
          ? { displayName: data.displayName }
          : {}),
        ...(data.avatarUrl !== undefined ? { avatarUrl: data.avatarUrl } : {}),
        ...(data.locale !== undefined ? { locale: data.locale } : {}),
        ...(data.reducedMotion !== undefined
          ? { reducedMotion: data.reducedMotion }
          : {}),
        ...(data.soundEnabled !== undefined
          ? { soundEnabled: data.soundEnabled }
          : {}),
      });
      return { ok: true, data: { user: toSafeUser(user) } };
    } catch (error) {
      return this.mapFailure(error);
    }
  }

  private async createAuthenticatedResult(
    user: AuthUserRecord,
    kind: "USER" | "GUEST",
    persistent: boolean,
  ): Promise<AuthResult<AuthSuccess>> {
    try {
      const issued = this.issueSession(kind, persistent);
      const record = await this.repository.createSession({
        tokenHash: issued.tokenHash,
        userId: user.id,
        kind,
        expiresAt: issued.expiresAt,
      });
      return {
        ok: true,
        data: this.toAuthenticatedSuccess(record, issued, persistent),
      };
    } catch (error) {
      return this.mapFailure(error);
    }
  }

  private async createNewAuthenticatedSuccess(
    user: CreateUserRecord,
    kind: "USER" | "GUEST",
    persistent: boolean,
  ): Promise<AuthSuccess> {
    const issued = this.issueSession(kind, persistent);
    const record = await this.repository.createUserWithSession({
      user,
      session: {
        tokenHash: issued.tokenHash,
        kind,
        expiresAt: issued.expiresAt,
      },
    });
    return this.toAuthenticatedSuccess(record, issued, persistent);
  }

  private issueSession(
    kind: "USER" | "GUEST",
    persistent: boolean,
  ): IssuedSessionToken {
    const ttlDays =
      kind === "GUEST"
        ? this.guestSessionTtlDays
        : persistent
          ? this.sessionTtlDays
          : this.nonPersistentSessionTtlDays;
    return issueSessionToken(ttlDays, this.now(), this.tokenFactory);
  }

  private toAuthenticatedSuccess(
    record: AuthSessionRecord,
    issued: IssuedSessionToken,
    persistent: boolean,
  ): AuthSuccess {
    return {
      user: toSafeUser(record.user),
      session: toSession(record),
      token: issued.token,
      persistent,
    };
  }

  private async cleanupGuest(record: AuthSessionRecord): Promise<void> {
    if (record.kind !== "GUEST" || !record.user.isGuest) return;
    await this.repository.deleteGuestUserIfUnreferenced?.(record.userId);
  }

  private mapFailure(error: unknown): AuthResult<never> {
    const mapped = mapRepositoryError(error);
    if (mapped.code === "UNIQUE") {
      if (mapped.target?.includes("username")) {
        return errorResult(
          "USERNAME_TAKEN",
          "That username is already in use.",
          {
            username: ["That username is already in use."],
          },
        );
      }
      if (mapped.target?.includes("email")) {
        return errorResult(
          "ACCOUNT_EXISTS",
          "An account with that email already exists.",
          { email: ["An account with that email already exists."] },
        );
      }
    }
    return errorResult(
      "AUTH_UNAVAILABLE",
      "The account service is temporarily unavailable.",
    );
  }
}

let serviceSingleton: AuthService | undefined;
let developmentRepository: InMemoryAuthRepository | undefined;
const developmentAuthStoreKey = Symbol.for("twoplayer.auth.development-store");
type DevelopmentAuthGlobal = typeof globalThis & {
  [developmentAuthStoreKey]?: InMemoryAuthStore;
};

function getDevelopmentAuthStore(): InMemoryAuthStore {
  const developmentGlobal = globalThis as DevelopmentAuthGlobal;
  developmentGlobal[developmentAuthStoreKey] ??= createInMemoryAuthStore();
  return developmentGlobal[developmentAuthStoreKey];
}

/** Lazily select the explicitly configured adapter; never silently mock production. */
export function getAuthService(): AuthService {
  if (serviceSingleton) return serviceSingleton;

  const env = getServerEnv();
  if (env.auth.mode === "development") {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "AUTH_MODE=development is intentionally unavailable in production.",
      );
    }

    developmentRepository =
      developmentRepository ??
      new InMemoryAuthRepository(getDevelopmentAuthStore());
    serviceSingleton = new AuthService({
      repository: developmentRepository,
      sessionTtlDays: env.auth.sessionTtlDays,
    });
  } else {
    serviceSingleton = new AuthService({
      repository: new PrismaAuthRepository(),
      sessionTtlDays: env.auth.sessionTtlDays,
    });
  }

  return serviceSingleton;
}

/** Test/dev reset hook; never call this from request code. */
export function resetAuthServiceForTests(): void {
  serviceSingleton = undefined;
  developmentRepository = undefined;

  const developmentGlobal = globalThis as DevelopmentAuthGlobal;
  const store = developmentGlobal[developmentAuthStoreKey];
  store?.users.clear();
  store?.sessions.clear();
  delete developmentGlobal[developmentAuthStoreKey];
}
