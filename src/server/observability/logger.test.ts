import { describe, expect, it } from "vitest";
import { redactMetadata } from "./logger";

describe("structured logging redaction", () => {
  it("redacts credentials and strips log injection characters", () => {
    const result = redactMetadata({
      token: "secret",
      password: "pw",
      message: "ok\nnext",
    });
    expect(result).toEqual({
      token: "[REDACTED]",
      password: "[REDACTED]",
      message: "ok next",
    });
  });
});
