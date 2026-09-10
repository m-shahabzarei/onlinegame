import { describe, expect, it } from "vitest";

import { loginInputSchema, registrationInputSchema } from "./auth";
import { profileUpdateSchema, settingsUpdateSchema } from "./profile";

describe("authentication input contracts", () => {
  it("normalizes registration email and enforces password confirmation", () => {
    const parsed = registrationInputSchema.safeParse({
      email: "  PLAYER@EXAMPLE.TEST ",
      username: "player_one",
      displayName: "Player One",
      password: "correct horse battery",
      passwordConfirmation: "correct horse battery",
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBe("player@example.test");

    expect(
      registrationInputSchema.safeParse({
        email: "player@example.test",
        username: "player_one",
        displayName: "Player One",
        password: "correct horse battery",
        passwordConfirmation: "different",
      }).success,
    ).toBe(false);
  });

  it("accepts email and username login aliases", () => {
    const emailLogin = loginInputSchema.safeParse({
      email: "player@example.test",
      password: "correct horse battery",
    });
    const usernameLogin = loginInputSchema.safeParse({
      username: "player_one",
      password: "correct horse battery",
    });

    expect(emailLogin.success).toBe(true);
    expect(usernameLogin.success).toBe(true);
    if (emailLogin.success)
      expect(emailLogin.data.identifier).toBe("player@example.test");
  });

  it("validates profile and settings fields", () => {
    expect(
      profileUpdateSchema.safeParse({
        username: "player_one",
        displayName: "Player One",
        avatarUrl: "https://cdn.example.test/avatar.png",
        bio: "Co-op ready",
      }).success,
    ).toBe(true);
    expect(
      profileUpdateSchema.safeParse({
        username: "not valid",
        displayName: "",
        avatarUrl: "not-a-url",
      }).success,
    ).toBe(false);
    expect(
      settingsUpdateSchema.safeParse({
        reducedMotion: true,
        soundEnabled: false,
      }).success,
    ).toBe(true);
    expect(
      profileUpdateSchema.safeParse({
        username: "player_one",
        displayName: "Player One",
        avatarUrl: "javascript:alert(1)",
      }).success,
    ).toBe(false);
    expect(settingsUpdateSchema.safeParse({ locale: "de" }).success).toBe(
      false,
    );
  });
});
