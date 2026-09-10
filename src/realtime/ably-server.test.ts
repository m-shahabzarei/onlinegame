// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { AblyServerAdapter } from "./ably-server";
afterEach(() => vi.unstubAllGlobals());
describe("Ably production boundary", () => {
  it("mints short-lived subscribe-only tokens for the authorized channel", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(Response.json({ token: "scoped-token" }));
    vi.stubGlobal("fetch", fetcher);
    const adapter = new AblyServerAdapter("test.key:test-secret");
    const ticket = await adapter.ticket("tp:room:opaque", Date.now() + 60_000);
    const [url, options] = fetcher.mock.calls[0]!;
    const body = JSON.parse(options.body);
    expect(url).toBe(
      "https://main.realtime.ably.net/keys/test.key/requestToken",
    );
    expect(JSON.parse(body.capability)).toEqual({
      "tp:room:opaque": ["subscribe"],
    });
    expect(body.ttl).toBeLessThanOrEqual(60_000);
    expect(ticket).toEqual({
      mode: "ably",
      channel: "tp:room:opaque",
      token: "scoped-token",
    });
    expect(JSON.stringify(ticket)).not.toContain("test-secret");
  });
  it("publishes only revision invalidations and fails safely on an outage", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(null, { status: 201 }));
    vi.stubGlobal("fetch", fetcher);
    const adapter = new AblyServerAdapter("test.key:test-secret");
    await adapter.publish("tp:room:opaque", 7);
    const body = JSON.parse(fetcher.mock.calls[0]![1].body);
    expect(body).toEqual({ name: "changed", data: '{"revision":7}' });
    fetcher.mockResolvedValue(new Response(null, { status: 503 }));
    await expect(adapter.publish("tp:room:opaque", 8)).rejects.toMatchObject({
      code: "SERVICE_UNAVAILABLE",
    });
  });
});
