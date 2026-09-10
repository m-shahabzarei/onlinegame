import { describe, expect, it } from "vitest";

import {
  playerCapacitySchema,
  roomCodeSchema,
  roomFoundationSchema,
} from "./room";

describe("roomCodeSchema", () => {
  it.each(["ABC123", "A1B2C3D4E5F6", "123456"])(
    "accepts the valid room code %s",
    (code) => {
      expect(roomCodeSchema.safeParse(code).success).toBe(true);
    },
  );

  it.each(["ABC12", "ABCDEFGHIJKLM", "abc123", "ABC-123", "ABC 123"])(
    "rejects the invalid room code %s",
    (code) => {
      expect(roomCodeSchema.safeParse(code).success).toBe(false);
    },
  );
});

describe("playerCapacitySchema", () => {
  it.each([2, 3, 4])("accepts a capacity of %i", (capacity) => {
    expect(playerCapacitySchema.safeParse(capacity).success).toBe(true);
  });

  it.each([1, 5, 2.5])("rejects a capacity of %s", (capacity) => {
    expect(playerCapacitySchema.safeParse(capacity).success).toBe(false);
  });
});

describe("roomFoundationSchema", () => {
  it("composes the room code and capacity constraints", () => {
    expect(
      roomFoundationSchema.safeParse({ code: "COOP24", maxPlayers: 2 }).success,
    ).toBe(true);
    expect(
      roomFoundationSchema.safeParse({ code: "coop24", maxPlayers: 8 }).success,
    ).toBe(false);
  });
});
