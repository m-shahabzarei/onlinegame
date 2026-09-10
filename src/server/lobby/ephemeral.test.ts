// @vitest-environment node
import { describe, expect, it } from "vitest";
import { LEASE_MS } from "@/domain/lobby";
import { LocalEphemeralStore } from "./ephemeral";
describe("ephemeral abuse limits and presence TTL", () => {
  it("limits across requests and reopens only after the window", async () => {
    let now = 1000;
    const store = new LocalEphemeralStore(() => now);
    await store.consume("code", 2, 60_000);
    await store.consume("code", 2, 60_000);
    await expect(store.consume("code", 2, 60_000)).rejects.toMatchObject({
      code: "RATE_LIMITED",
    });
    now += 60_000;
    await expect(store.consume("code", 2, 60_000)).resolves.toBeUndefined();
  });
  it("deduplicates identities and expires online presence at the lease boundary", async () => {
    let now = 1000;
    const store = new LocalEphemeralStore(() => now);
    await store.heartbeat("a", null);
    await store.heartbeat("a", "room");
    expect(await store.summary()).toEqual({ online: 1, inLobby: 1, inGame: 0 });
    now += LEASE_MS;
    expect(await store.summary()).toEqual({ online: 0, inLobby: 0, inGame: 0 });
  });
});
