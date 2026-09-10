import "server-only";
import { LobbyError } from "@/domain/lobby";
import type { RealtimePublisher, SubscriptionTicket } from "./lobby-contracts";

/** Provider-specific REST calls are confined here. Clients only receive subscribe capability. */
export class AblyServerAdapter implements RealtimePublisher {
  constructor(private apiKey: string) {}
  private async request(path: string, body: unknown): Promise<Response> {
    const response = await fetch(`https://main.realtime.ably.net${path}`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(this.apiKey).toString("base64")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new LobbyError("SERVICE_UNAVAILABLE");
    return response;
  }
  async publish(channel: string, revision: number) {
    // No identities, codes, or snapshots are published, including after a kick.
    await this.request(`/channels/${encodeURIComponent(channel)}/messages`, {
      name: "changed",
      data: JSON.stringify({ revision }),
    });
  }
  async ticket(
    channel: string,
    sessionExpiresAt: number,
  ): Promise<SubscriptionTicket> {
    const keyName = this.apiKey.split(":")[0];
    const ttl = Math.min(5 * 60_000, sessionExpiresAt - Date.now());
    if (ttl <= 0) throw new LobbyError("UNAUTHENTICATED");
    const response = await this.request(
      `/keys/${encodeURIComponent(keyName ?? "")}/requestToken`,
      {
        keyName,
        timestamp: Date.now(),
        ttl,
        capability: JSON.stringify({ [channel]: ["subscribe"] }),
      },
    );
    const result = (await response.json()) as { token: string };
    return { mode: "ably", channel, token: result.token };
  }
}
