import type { RealtimePublisher } from "./lobby-contracts";
/** Test event bus. Browser development transport uses bounded snapshot refresh. */
export class LocalRealtimePublisher implements RealtimePublisher {
  private listeners = new Map<string, Set<(revision: number) => void>>();
  async publish(channel: string, revision: number) {
    for (const listener of this.listeners.get(channel) ?? [])
      listener(revision);
  }
  listen(channel: string, listener: (revision: number) => void) {
    const set = this.listeners.get(channel) ?? new Set();
    set.add(listener);
    this.listeners.set(channel, set);
    return () => {
      set.delete(listener);
      if (!set.size) this.listeners.delete(channel);
    };
  }
}
