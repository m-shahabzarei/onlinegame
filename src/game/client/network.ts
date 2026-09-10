import { z } from "zod";
import { LIMITS } from "../shared/config";
import {
  serverMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from "../shared/protocol";
export type ConnectionState =
  "Connecting" | "Connected" | "Reconnecting" | "Disconnected" | "Failed";
const bootstrapSchema = z.object({
  ok: z.literal(true),
  data: z.object({
    token: z.string(),
    wsUrl: z.url(),
    expiresAt: z.number(),
    returnPath: z.string(),
  }),
});
export class GameplayNetwork {
  state: ConnectionState = "Connecting";
  socket: WebSocket | null = null;
  serverOffset = 0;
  ping = 0;
  lastMessageAt = 0;
  inbound = 0;
  outbound = 0;
  inboundBytes = 0;
  outboundBytes = 0;
  private disposed = false;
  private attempts = 0;
  private generation = 0;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval>;
  private request: AbortController | null = null;
  private terminal = false;
  constructor(
    readonly matchId: string,
    readonly receive: (message: ServerMessage) => void,
    readonly changed: (state: ConnectionState, error: string) => void,
  ) {
    this.heartbeat = setInterval(() => {
      if (this.socket?.readyState !== WebSocket.OPEN) return;
      if (Date.now() - this.lastMessageAt > LIMITS.silenceMs) {
        this.socket.close();
        return;
      }
      this.send({ v: 2, type: "ping", sentAt: Date.now() });
    }, LIMITS.heartbeatMs);
  }
  private setState(state: ConnectionState, error = "") {
    this.state = state;
    this.changed(state, error);
  }
  async connect() {
    if (this.disposed) return;
    const generation = ++this.generation;
    this.request?.abort();
    this.request = new AbortController();
    this.setState(this.attempts ? "Reconnecting" : "Connecting");
    try {
      const response = await fetch(
        `/api/gameplay/${encodeURIComponent(this.matchId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "bootstrap" }),
          cache: "no-store",
          signal: AbortSignal.any([
            this.request.signal,
            AbortSignal.timeout(8000),
          ]),
        },
      );
      if (!response.ok) {
        if (response.status === 403 || response.status === 410) {
          this.terminal = true;
          throw new Error(
            response.status === 403
              ? "Your session cannot enter this match. Return to rooms to sign in again."
              : "This training session has ended. Return to rooms to reserve another match.",
          );
        }
        throw new Error(
          "The gameplay service is unavailable. Retry or return to rooms.",
        );
      }
      const bootstrap = bootstrapSchema.parse(await response.json()).data;
      if (this.disposed || generation !== this.generation) return;
      const url = new URL(bootstrap.wsUrl);
      if (
        !["ws:", "wss:"].includes(url.protocol) ||
        (location.protocol === "https:" && url.protocol !== "wss:")
      )
        throw new Error("The gameplay connection is not configured securely.");
      const socket = new WebSocket(url);
      this.socket = socket;
      this.lastMessageAt = Date.now();
      const handshake = setTimeout(() => {
        if (this.state !== "Connected") socket.close();
      }, LIMITS.handshakeMs + 1000);
      socket.onopen = () => {
        if (this.disposed || generation !== this.generation) {
          socket.close();
          return;
        }
        this.send({ v: 2, type: "join", token: bootstrap.token });
      };
      socket.onmessage = (event) => {
        if (this.disposed || generation !== this.generation) return;
        try {
          if (typeof event.data !== "string" || event.data.length > 32768)
            throw new Error("Invalid server frame");
          this.inbound++;
          this.inboundBytes += new TextEncoder().encode(event.data).length;
          const message = serverMessageSchema.parse(JSON.parse(event.data));
          this.lastMessageAt = Date.now();
          if (message.type === "welcome") {
            clearTimeout(handshake);
            this.attempts = 0;
            this.serverOffset = message.snapshot.time - Date.now();
            this.setState("Connected");
          }
          if (message.type === "pong") {
            this.ping = Math.max(0, Date.now() - message.sentAt);
            const offset = message.serverTime + this.ping / 2 - Date.now();
            this.serverOffset = this.serverOffset * 0.75 + offset * 0.25;
          }
          if (message.type === "serverError") {
            this.terminal = [
              "UNAUTHORIZED",
              "MATCH_UNAVAILABLE",
              "PROTOCOL_MISMATCH",
              "SLOT_CONNECTED",
            ].includes(message.code);
            const error =
              message.code === "SLOT_CONNECTED"
                ? "This player is already connected in another tab. Close it, then retry."
                : "The server rejected this connection. Retry or return to rooms.";
            this.setState("Failed", error);
            socket.close();
            return;
          }
          this.receive(message);
        } catch {
          this.terminal = true;
          this.setState(
            "Failed",
            "The server protocol is incompatible. Reload the page.",
          );
          socket.close();
        }
      };
      socket.onclose = () => {
        clearTimeout(handshake);
        if (generation !== this.generation || this.disposed) return;
        this.socket = null;
        if (!this.terminal) this.schedule();
      };
      socket.onerror = () => {}; // close is the single retry owner.
    } catch (error) {
      if (this.disposed || generation !== this.generation) return;
      if (this.terminal)
        this.setState(
          "Failed",
          error instanceof Error ? error.message : "Cannot connect.",
        );
      else this.schedule();
    }
  }
  private schedule() {
    if (this.disposed) return;
    if (this.attempts >= 6) {
      this.setState(
        "Failed",
        "Connection recovery timed out. Retry during the match grace period, or return to rooms.",
      );
      return;
    }
    this.setState("Reconnecting", "Reconnecting to your existing player slot…");
    const delay =
      Math.min(8000, 500 * 2 ** this.attempts++) + Math.random() * 200;
    this.retryTimer = setTimeout(() => void this.connect(), delay);
  }
  retry() {
    if (this.disposed) return;
    this.terminal = false;
    this.attempts = 0;
    clearTimeout(this.retryTimer);
    this.generation++;
    this.socket?.close();
    this.socket = null;
    void this.connect();
  }
  send(message: ClientMessage) {
    if (
      this.socket?.readyState !== WebSocket.OPEN ||
      this.socket.bufferedAmount > 16384
    )
      return false;
    const raw = JSON.stringify(message);
    this.socket.send(raw);
    this.outbound++;
    this.outboundBytes += raw.length;
    return true;
  }
  serverNow() {
    return Date.now() + this.serverOffset;
  }
  async leave() {
    this.send({ v: 2, type: "leaveMatch" });
    const cleanupRequest = new AbortController();
    const timeout = setTimeout(() => cleanupRequest.abort(), 5000);
    try {
      await fetch(`/api/gameplay/${encodeURIComponent(this.matchId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "leave" }),
        signal: cleanupRequest.signal,
        keepalive: true,
      });
    } catch {
      // The gameplay leave was already sent. If the finite web request fails,
      // server disconnect grace and ownership expiry still finish cleanup.
      // Leaving the route must not produce an unhandled network rejection.
    } finally {
      clearTimeout(timeout);
      this.dispose();
    }
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.generation++;
    this.request?.abort();
    clearTimeout(this.retryTimer);
    clearInterval(this.heartbeat);
    this.socket?.close();
    this.socket = null;
    this.state = "Disconnected";
  }
}
