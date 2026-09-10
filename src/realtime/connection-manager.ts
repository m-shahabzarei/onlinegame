import type { ConnectionState } from "./contracts";
import type {
  ConnectionManager,
  RealtimeSubscriber,
  SubscriptionTicket,
} from "./lobby-contracts";

interface Options {
  ticket(): Promise<SubscriptionTicket>;
  refresh(): Promise<void>;
  state(value: ConnectionState): void;
  error(error: unknown): void;
  subscriber: RealtimeSubscriber;
}
/** Bounded retry, token renewal, scoped resources, and authoritative snapshot recovery. */
export class LobbyConnectionManager implements ConnectionManager {
  private stopped = true;
  private generation = 0;
  private attempt = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private renewal: ReturnType<typeof setTimeout> | undefined;
  private unsubscribe: (() => void) | undefined;
  private refreshing = false;
  private interval = 30_000;
  constructor(private options: Options) {}
  connect() {
    this.stopped = false;
    this.attempt = 0;
    this.options.state("CONNECTING");
    void this.open();
  }
  retry() {
    this.disconnect();
    this.connect();
  }
  disconnect() {
    this.stopped = true;
    this.generation++;
    this.clear();
  }
  private clear() {
    clearTimeout(this.timer);
    clearTimeout(this.renewal);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
  private async open() {
    const generation = ++this.generation;
    this.clear();
    try {
      const ticket = await this.options.ticket();
      if (this.stopped || generation !== this.generation) return;
      this.interval = ticket.mode === "local" ? 4000 : 30_000;
      await this.options.refresh();
      if (this.stopped || generation !== this.generation) return;
      this.unsubscribe = this.options.subscriber.subscribe(
        ticket,
        () => {
          void this.refresh(generation);
        },
        (state) => {
          if (this.stopped || generation !== this.generation) return;
          if (state === "RECONNECTING")
            this.failed(new Error("Realtime transport interrupted."));
          else {
            this.options.state(state);
            if (state === "CONNECTED") this.attempt = 0;
          }
        },
      );
      this.schedule(generation);
      this.renewal = setTimeout(() => {
        void this.open();
      }, 240_000);
    } catch (error) {
      if (!this.stopped && generation === this.generation) this.failed(error);
    }
  }
  private schedule(generation: number) {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.refresh(generation);
    }, this.interval);
  }
  private async refresh(generation: number) {
    if (this.stopped || generation !== this.generation || this.refreshing)
      return;
    this.refreshing = true;
    try {
      await this.options.refresh();
      if (!this.stopped && generation === this.generation)
        this.schedule(generation);
    } catch (error) {
      if (!this.stopped && generation === this.generation) this.failed(error);
    } finally {
      this.refreshing = false;
    }
  }
  private failed(error: unknown) {
    this.clear();
    this.generation++;
    this.options.error(error);
    if (++this.attempt > 5) {
      this.options.state("FAILED");
      return;
    }
    this.options.state(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "DISCONNECTED"
        : "RECONNECTING",
    );
    this.timer = setTimeout(
      () => {
        void this.open();
      },
      Math.min(1000 * 2 ** (this.attempt - 1), 16_000),
    );
  }
}
