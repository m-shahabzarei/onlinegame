import { afterEach, expect, it, vi } from "vitest";
import { GameplayNetwork } from "./network";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("sends leave and closes timers even when trusted HTTP cleanup times out", async () => {
  vi.useFakeTimers();
  const fetch = vi
    .fn()
    .mockRejectedValue(new DOMException("Timed out", "TimeoutError"));
  vi.stubGlobal("fetch", fetch);
  const network = new GameplayNetwork("match", vi.fn(), vi.fn());
  const send = vi.spyOn(network, "send").mockReturnValue(true);
  await expect(network.leave()).resolves.toBeUndefined();
  expect(send).toHaveBeenCalledWith({ v: 3, type: "leaveMatch" });
  expect(fetch).toHaveBeenCalledWith(
    "/api/gameplay/match",
    expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ action: "leave" }),
      keepalive: true,
    }),
  );
  expect(network.state).toBe("Disconnected");
  expect(network.socket).toBeNull();
  expect(vi.getTimerCount()).toBe(0);
});
