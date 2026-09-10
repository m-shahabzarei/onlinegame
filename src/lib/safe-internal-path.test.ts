import { describe, expect, it } from "vitest";

import { getSafeInternalPath } from "./safe-internal-path";

describe("getSafeInternalPath", () => {
  it("preserves a normalized internal path including search and hash", () => {
    expect(
      getSafeInternalPath(" /games/nightfall-protocol?view=brief#overview "),
    ).toBe("/games/nightfall-protocol?view=brief#overview");
    expect(getSafeInternalPath(["/profile", "/settings"])).toBe("/profile");
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "\\evil.example",
    "/games\n/other",
  ])("rejects unsafe redirect target %s", (target) => {
    expect(getSafeInternalPath(target, "/")).toBe("/");
  });
});
