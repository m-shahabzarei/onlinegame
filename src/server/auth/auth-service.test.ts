import { describe, expect, it } from "vitest";

import {
  AuthRepositoryError,
  AuthService,
  InMemoryAuthRepository,
  type InMemoryAuthStore,
} from "./auth-service";
import { hashSessionToken } from "./session";

const registration = {
  email: "pilot@example.test",
  username: "pilot_one",
  displayName: "Pilot One",
  password: "a-secure-test-password",
  passwordConfirmation: "a-secure-test-password",
};

describe("AuthService", () => {
  it("shares an explicitly supplied development store across repository instances", async () => {
    const store: InMemoryAuthStore = {
      users: new Map(),
      sessions: new Map(),
    };
    const writer = new InMemoryAuthRepository(store);
    const reader = new InMemoryAuthRepository(store);
    const service = new AuthService({
      repository: writer,
      tokenFactory: () => "cross-bundle-token",
    });

    const guest = await service.createGuestSession();
    expect(guest.ok).toBe(true);
    if (!guest.ok) return;

    expect(
      await reader.findUserByUsername(guest.data.user.username),
    ).toMatchObject({
      id: guest.data.user.id,
      isGuest: true,
    });
    expect(
      await reader.findSessionByTokenHash(hashSessionToken(guest.data.token)),
    ).toMatchObject({ userId: guest.data.user.id, kind: "GUEST" });
  });

  it("registers and logs in without returning or storing plaintext passwords", async () => {
    const repository = new InMemoryAuthRepository();
    let sequence = 0;
    const service = new AuthService({
      repository,
      tokenFactory: () => `registration-token-${sequence++}`,
    });

    const registered = await service.register(registration);
    expect(registered.ok).toBe(true);
    if (!registered.ok) return;

    expect(registered.data.user).not.toHaveProperty("passwordHash");
    const stored = await repository.findUserByEmail("pilot@example.test");
    expect(stored?.passwordHash).toBeTruthy();
    expect(stored?.passwordHash).not.toContain(registration.password);

    const login = await service.login({
      email: registration.email,
      password: registration.password,
      remember: true,
    });
    expect(login.ok).toBe(true);

    const invalid = await service.login({
      identifier: registration.email,
      password: "wrong-password",
    });
    expect(invalid).toMatchObject({
      ok: false,
      error: { code: "INVALID_CREDENTIALS" },
    });
  });

  it("does not retain a registered user when its initial session insert fails", async () => {
    const store: InMemoryAuthStore = {
      users: new Map(),
      sessions: new Map(),
    };
    const repository = new InMemoryAuthRepository(store);
    const existing = await repository.createUser({
      email: "existing@example.test",
      username: "existing_player",
      displayName: "Existing Player",
    });
    const collidingToken = "colliding-registration-token";
    await repository.createSession({
      tokenHash: hashSessionToken(collidingToken),
      userId: existing.id,
      kind: "USER",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    });
    const service = new AuthService({
      repository,
      tokenFactory: () => collidingToken,
    });

    const result = await service.register(registration);

    expect(result).toMatchObject({
      ok: false,
      error: { code: "AUTH_UNAVAILABLE" },
    });
    expect(await repository.findUserByEmail(registration.email)).toBeNull();
    expect(store.users.size).toBe(1);
    expect(store.sessions.size).toBe(1);
  });

  it("rejects duplicate accounts and supports non-persistent sessions", async () => {
    const repository = new InMemoryAuthRepository();
    const now = new Date("2026-01-01T00:00:00.000Z");
    let sequence = 0;
    const service = new AuthService({
      repository,
      now: () => now,
      tokenFactory: () => `token-${sequence++}`,
    });

    const first = await service.register(registration);
    expect(first.ok).toBe(true);
    const duplicate = await service.register(registration);
    expect(duplicate).toMatchObject({
      ok: false,
      error: { code: "ACCOUNT_EXISTS" },
    });

    const short = await service.login({
      identifier: registration.username,
      password: registration.password,
      remember: false,
    });
    expect(short.ok).toBe(true);
    if (!short.ok || !first.ok) return;
    expect(short.data.persistent).toBe(false);
    expect(short.data.session.expiresAt.getTime() - now.getTime()).toBe(
      24 * 60 * 60 * 1_000,
    );
  });

  it("creates a one-day guest and removes it after logout", async () => {
    const repository = new InMemoryAuthRepository();
    const service = new AuthService({
      repository,
      now: () => new Date("2026-01-01T00:00:00.000Z"),
      tokenFactory: () => "guest-token",
    });

    const guest = await service.createGuestSession();
    expect(guest.ok).toBe(true);
    if (!guest.ok) return;

    expect(guest.data.user.isGuest).toBe(true);
    expect(guest.data.session.expiresAt.getTime()).toBe(
      new Date("2026-01-02T00:00:00.000Z").getTime(),
    );
    expect(
      await repository.findSessionByTokenHash(
        hashSessionToken(guest.data.token),
      ),
    ).not.toBeNull();

    await service.logout(guest.data.token);
    expect(
      await repository.findSessionByTokenHash(
        hashSessionToken(guest.data.token),
      ),
    ).toBeNull();
    expect(
      await repository.findUserByUsername(guest.data.user.username),
    ).toBeNull();
  });

  it("does not retain a guest when its initial session insert fails", async () => {
    const store: InMemoryAuthStore = {
      users: new Map(),
      sessions: new Map(),
    };
    const repository = new InMemoryAuthRepository(store);
    const existing = await repository.createUser({
      email: "existing@example.test",
      username: "existing_player",
      displayName: "Existing Player",
    });
    const collidingToken = "colliding-guest-token";
    await repository.createSession({
      tokenHash: hashSessionToken(collidingToken),
      userId: existing.id,
      kind: "USER",
      expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    });
    const service = new AuthService({
      repository,
      tokenFactory: () => collidingToken,
    });

    const result = await service.createGuestSession();

    expect(result).toMatchObject({
      ok: false,
      error: { code: "AUTH_UNAVAILABLE" },
    });
    expect(
      [...store.users.values()].filter((user) => user.isGuest),
    ).toHaveLength(0);
    expect(store.users.size).toBe(1);
    expect(store.sessions.size).toBe(1);
  });

  it("expires sessions and cleans up an unreferenced guest", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    const repository = new InMemoryAuthRepository();
    const service = new AuthService({
      repository,
      now: () => now,
      tokenFactory: () => "expiring-guest-token",
    });

    const guest = await service.createGuestSession();
    expect(guest.ok).toBe(true);
    if (!guest.ok) return;
    now = new Date("2026-01-03T00:00:00.000Z");

    expect(await service.getCurrentSession(guest.data.token)).toBeNull();
    expect(
      await repository.findUserByUsername(guest.data.user.username),
    ).toBeNull();
  });

  it("opportunistically removes abandoned expired guests", async () => {
    let now = new Date("2026-01-01T00:00:00.000Z");
    let sequence = 0;
    const repository = new InMemoryAuthRepository();
    const service = new AuthService({
      repository,
      now: () => now,
      tokenFactory: () => `guest-token-${sequence++}`,
    });

    const abandoned = await service.createGuestSession();
    expect(abandoned.ok).toBe(true);
    if (!abandoned.ok) return;

    now = new Date("2026-01-03T00:00:00.000Z");
    const nextGuest = await service.createGuestSession();

    expect(nextGuest.ok).toBe(true);
    expect(
      await repository.findUserByUsername(abandoned.data.user.username),
    ).toBeNull();
  });

  it("keeps public reads forgiving while strict protected reads expose outages", async () => {
    class UnavailableRepository extends InMemoryAuthRepository {
      override async findSessionByTokenHash(tokenHash: string): Promise<never> {
        void tokenHash;
        throw new AuthRepositoryError("UNAVAILABLE", "Database unavailable.");
      }
    }

    const service = new AuthService({
      repository: new UnavailableRepository(),
    });

    await expect(service.getCurrentSession("opaque-token")).resolves.toBeNull();
    await expect(
      service.getCurrentSessionStrict("opaque-token"),
    ).rejects.toMatchObject({ code: "UNAVAILABLE" });
  });

  it("enforces username uniqueness during a profile update", async () => {
    const repository = new InMemoryAuthRepository();
    const first = await repository.createUser({
      username: "first_player",
      displayName: "First Player",
    });
    await repository.createUser({
      username: "second_player",
      displayName: "Second Player",
    });
    const service = new AuthService({ repository });

    const result = await service.updateProfile(first.id, {
      username: "second_player",
      displayName: "First Player",
      avatarUrl: "",
      bio: "",
    });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "USERNAME_TAKEN",
        fieldErrors: { username: ["That username is already in use."] },
      },
    });
  });
});
