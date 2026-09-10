"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ConnectionState } from "@/realtime/contracts";
import type { SubscriptionTicket } from "@/realtime/lobby-contracts";
import { BrowserRealtimeSubscriber } from "@/realtime/browser-subscriber";
import { LobbyConnectionManager } from "@/realtime/connection-manager";
import { lobbyRequest } from "./client";

export function useLobbyConnection(
  query: { code?: string; slug?: string },
  refresh: () => Promise<void>,
) {
  const [connection, setConnection] = useState<ConnectionState>("CONNECTING");
  const manager = useRef<LobbyConnectionManager | null>(null);
  const refreshRef = useRef(refresh);
  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);
  const code = query.code;
  const slug = query.slug;
  useEffect(() => {
    const controller = new AbortController();
    const instance = new LobbyConnectionManager({
      ticket: () =>
        lobbyRequest<SubscriptionTicket>(
          {
            op: "ticket",
            ...(code ? { code } : { slug: slug ?? "nightfall-protocol" }),
          },
          undefined,
          controller.signal,
        ),
      refresh: () => refreshRef.current(),
      state: setConnection,
      error: () => {},
      subscriber: new BrowserRealtimeSubscriber(),
    });
    manager.current = instance;
    instance.connect();
    const online = () => instance.retry();
    const offline = () => {
      instance.disconnect();
      setConnection("DISCONNECTED");
    };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      controller.abort();
      instance.disconnect();
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [code, slug]);
  const retry = useCallback(() => manager.current?.retry(), []);
  return { connection, retry };
}
