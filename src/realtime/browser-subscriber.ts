import type { RealtimeSubscriber, SubscriptionTicket } from "./lobby-contracts";
import type { ConnectionState } from "./contracts";

/** Only this browser adapter knows Ably's transport URL. */
export class BrowserRealtimeSubscriber implements RealtimeSubscriber {
  subscribe(
    ticket: SubscriptionTicket,
    invalidate: () => void,
    status: (state: ConnectionState) => void,
  ) {
    if (ticket.mode === "local") {
      status("CONNECTED");
      return () => {};
    }
    const url = new URL("https://main.realtime.ably.net/sse");
    url.search = new URLSearchParams({
      channels: ticket.channel,
      accessToken: ticket.token ?? "",
      v: "1.2",
      enveloped: "false",
    }).toString();
    const source = new EventSource(url);
    source.onopen = () => {
      status("CONNECTED");
      invalidate();
    };
    source.onmessage = () => invalidate();
    source.onerror = () => {
      source.close();
      status("RECONNECTING");
    };
    return () => source.close();
  }
}
