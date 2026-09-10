// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LobbyConnectionManager } from "./connection-manager";
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
describe("bounded connection manager", () => {
  it("fails after bounded retries and can explicitly recover", async () => {
    const ticket = vi.fn().mockRejectedValue(new Error("offline"));
    const refresh = vi.fn().mockResolvedValue(undefined);
    const state = vi.fn();
    const stop = vi.fn();
    const manager = new LobbyConnectionManager({
      ticket,
      refresh,
      state,
      error: vi.fn(),
      subscriber: {
        subscribe: (_t, _invalidate, status) => {
          status("CONNECTED");
          return stop;
        },
      },
    });
    manager.connect();
    await vi.advanceTimersByTimeAsync(32_000);
    expect(ticket).toHaveBeenCalledTimes(6);
    expect(state).toHaveBeenLastCalledWith("FAILED");
    await vi.advanceTimersByTimeAsync(120_000);
    expect(ticket).toHaveBeenCalledTimes(6);
    ticket.mockResolvedValue({ mode: "local", channel: "test" });
    manager.retry();
    await vi.advanceTimersByTimeAsync(1);
    expect(state).toHaveBeenLastCalledWith("CONNECTED");
    expect(refresh).toHaveBeenCalledOnce();
    manager.disconnect();
    expect(stop).toHaveBeenCalledOnce();
  });
  it("cleans subscriptions and timers and ignores late connection results", async () => {
    let resolve!: (value: { mode: "local"; channel: string }) => void;
    const ticket = vi.fn(
      () =>
        new Promise<{ mode: "local"; channel: string }>((r) => {
          resolve = r;
        }),
    );
    const refresh = vi.fn();
    const subscribe = vi.fn();
    const manager = new LobbyConnectionManager({
      ticket,
      refresh,
      subscriber: { subscribe },
      state: vi.fn(),
      error: vi.fn(),
    });
    manager.connect();
    manager.disconnect();
    resolve({ mode: "local", channel: "test" });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).not.toHaveBeenCalled();
    expect(subscribe).not.toHaveBeenCalled();
  });
  it("restores an authoritative snapshot on each reconnect and scopes refresh intervals", async () => {
    const refresh = vi.fn().mockResolvedValue(undefined);
    const unsubscribe = vi.fn();
    const manager = new LobbyConnectionManager({
      ticket: async () => ({ mode: "local", channel: "room" }),
      refresh,
      state: vi.fn(),
      error: vi.fn(),
      subscriber: { subscribe: () => unsubscribe },
    });
    manager.connect();
    await vi.advanceTimersByTimeAsync(4001);
    expect(refresh).toHaveBeenCalledTimes(2);
    manager.retry();
    await vi.advanceTimersByTimeAsync(1);
    expect(refresh).toHaveBeenCalledTimes(3);
    expect(unsubscribe).toHaveBeenCalledOnce();
    manager.disconnect();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(refresh).toHaveBeenCalledTimes(3);
  });
});
