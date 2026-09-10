// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
vi.mock("@/server/dal/session", () => ({
  getStrictCurrentSession: vi.fn(async () => null),
}));
import {
  boundedText,
  gameplayRequest,
  lifecycleRequest,
  sweepRequest,
} from "./http";
describe("gameplay HTTP trust boundary", () => {
  it("rejects missing sessions and cross-origin requests", async () => {
    const make = (origin: string) =>
      new Request("http://localhost/api/gameplay/m", {
        method: "POST",
        headers: { origin, "Content-Type": "application/json" },
        body: '{"action":"bootstrap"}',
      });
    expect((await gameplayRequest(make("http://localhost"), "m")).status).toBe(
      403,
    );
    expect(
      (await gameplayRequest(make("http://attacker.invalid"), "m")).ok,
    ).toBe(false);
  });
  it("bounds streaming bodies without trusting Content-Length", async () => {
    await expect(
      boundedText(
        new Request("http://localhost", {
          method: "POST",
          body: "x".repeat(300),
        }),
        256,
      ),
    ).rejects.toMatchObject({ code: "INVALID_MESSAGE" });
  });
  it("rejects unsigned lifecycle calls and unauthenticated sweep", async () => {
    expect(
      (
        await lifecycleRequest(
          new Request("http://localhost", { method: "POST", body: "invalid" }),
        )
      ).status,
    ).toBe(403);
    expect((await sweepRequest(new Request("http://localhost"))).status).toBe(
      403,
    );
  });
});
