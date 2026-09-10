import { describe, expect, it } from "vitest";
import { advanceChallengeProgress, CHALLENGES, COSMETICS } from "./phase8";

describe("Phase 8 bounded content", () => {
  it("advances challenge progress once and caps at the target", () => {
    const result = advanceChallengeProgress(2, 9, 3);
    expect(result.progress).toBe(3);
    expect(result.completed).toBe(true);
  });

  it("keeps curated cosmetics separate from gameplay values", () => {
    expect(CHALLENGES.every((challenge) => challenge.target > 0)).toBe(true);
    expect(COSMETICS.every((cosmetic) => !("damage" in cosmetic))).toBe(true);
  });
});
