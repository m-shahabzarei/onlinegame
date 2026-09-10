import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("uses a random salt and verifies without storing plaintext", async () => {
    const password = "a sufficiently long test password";
    const first = await hashPassword(password);
    const second = await hashPassword(password);

    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("incorrect password", first)).toBe(false);
    expect(await verifyPassword(password, "not-a-valid-hash")).toBe(false);
  });
});
