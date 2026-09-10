// @vitest-environment node
import { describe, expect, it } from "vitest";
import { generateRoomCode } from "@/server/lobby/room-code";
import {
  chooseHost,
  inviteCodeSchema,
  lobbyErrorResponse,
  LobbyError,
  normalizeRoomCode,
  reconcileSnapshot,
  type LobbySnapshot,
  type StoredMember,
} from "./lobby";
describe("secure invites and typed errors", () => {
  it("generates random eight-character uppercase codes without ambiguous symbols", () => {
    const codes = Array.from({ length: 1000 }, generateRoomCode);
    expect(new Set(codes).size).toBe(1000);
    for (const code of codes) {
      expect(inviteCodeSchema.safeParse(code).success).toBe(true);
      expect(code).not.toMatch(/[ILOU01]/);
    }
  });
  it("normalizes whitespace, hyphens, and case", () => {
    expect(normalizeRoomCode("  abcd- 2345 ")).toBe("ABCD2345");
    expect(inviteCodeSchema.parse("abcd 2345")).toBe("ABCD2345");
  });
  it.each([
    "ABC12345",
    "ABCD234",
    "ABCD23456",
    "ABCD23O5",
    "ABCD23I5",
    "ABCD23U5",
    "ABCD23L5",
    "<script>",
  ])("rejects invalid invite %s", (code) =>
    expect(inviteCodeSchema.safeParse(code).success).toBe(false),
  );
  it("maps typed errors and sanitizes unexpected messages", () => {
    expect(lobbyErrorResponse(new LobbyError("ROOM_FULL"))).toMatchObject({
      status: 409,
      error: { code: "ROOM_FULL" },
    });
    expect(
      JSON.stringify(lobbyErrorResponse(new Error("secret database password"))),
    ).not.toContain("secret");
  });
  it("transfers by earliest join then stable ID", () => {
    const members = [
      { user: { id: "z" }, joinedAt: 2 },
      { user: { id: "b" }, joinedAt: 1 },
      { user: { id: "a" }, joinedAt: 1 },
    ] as StoredMember[];
    expect(chooseHost(members)?.user.id).toBe("a");
    expect(chooseHost([])).toBeUndefined();
  });
  it("rejects stale revisions and out-of-order presence snapshots", () => {
    const current = {
      code: "ABCD2345",
      stateVersion: 3,
      observedAt: 100,
    } as LobbySnapshot;
    expect(
      reconcileSnapshot(current, {
        ...current,
        stateVersion: 2,
        observedAt: 200,
      }),
    ).toBe(current);
    expect(reconcileSnapshot(current, { ...current, observedAt: 99 })).toBe(
      current,
    );
    expect(
      reconcileSnapshot(current, { ...current, stateVersion: 4 }).stateVersion,
    ).toBe(4);
  });
});
