import { describe, expect, it } from "vitest";
import { getFeatureFlags } from "./feature-flags";

describe("feature flags", () => {
  it("uses safe defaults and parses explicit operations values", () => {
    expect(getFeatureFlags({}).maintenance).toBe(false);
    expect(
      getFeatureFlags({
        TWOPLAYER_FLAG_MAINTENANCE: "1",
        TWOPLAYER_TELEMETRY_SAMPLE_RATE: "0.25",
      }),
    ).toMatchObject({ maintenance: true, telemetrySampleRate: 0.25 });
  });
});
