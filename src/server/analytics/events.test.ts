import { describe, expect, it } from "vitest";
import { track } from "./events";

describe("privacy-conscious analytics", () => {
  it("drops opted-out and invalid events", () => {
    expect(track({ name: "victory", version: 1 }, true)).toBe(false);
    expect(track({ name: "secret", version: 1 })).toBe(false);
  });
});
