import { createServer, type IncomingMessage } from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";
import {
  LIMITS,
  SIMULATION,
  type SimulationConfig,
} from "../../src/game/shared/config";
import { terminalState } from "../../src/game/shared/lifecycle";
import { initPhysics } from "../../src/game/shared/physics";
import {
  GameError,
  parseClientMessage,
  type MatchState,
  type ServerMessage,
} from "../../src/game/shared/protocol";
import {
  controlClaimsSchema,
  joinClaimsSchema,
  ReplayGuard,
  verifyToken,
} from "../../src/game/shared/tokens";
import { FixedAccumulator, RateBudget } from "../../src/game/shared/time";
import { MatchInstance, type Peer } from "./match";
import type { PvEOptions } from "./pve/simulation";
import type { PvEOutcome } from "../../src/game/shared/pve";
export interface ServiceOptions {
  joinSecret: string;
  controlSecret: string;
  origins: string[];
  simulation?: SimulationConfig;
  pve?: PvEOptions;
  lifecycle: (
    matchId: string,
    runtimeId: string,
    state: MatchState,
    outcome?: PvEOutcome,
  ) => Promise<void>;
}
async function readBody(req: IncomingMessage) {
  let body = "",
    size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 8192) throw new GameError("INVALID_MESSAGE");
    body += chunk.toString();
  }
  return body;
}
/** No cookies, join tickets, room codes, IP addresses or raw frames enter logs. */
export async function createGameplayService(options: ServiceOptions) {
  await initPhysics();
  const config = options.simulation ?? SIMULATION;
  const serverEpoch = randomUUID();
  const matches = new Map<string, MatchInstance>();
  const replay = new ReplayGuard();
  const callbacks = new Map<
    string,
    { state: MatchState; confirmedAt: number; sentAt: number; busy: boolean }
  >();
  const rejected = new Map<string, number>();
  const metrics = {
    connectionsAccepted: 0,
    handshakesSucceeded: 0,
    commandsRejected: 0,
    ticks: 0,
    tickDurationMs: 0,
    tickDriftMs: 0,
  };
  const reject = (code: string) =>
    rejected.set(code, (rejected.get(code) ?? 0) + 1);
  const admission = new RateBudget(30, 60, Date.now());
  let closing = false;
  async function persist(match: MatchInstance) {
    const entry = callbacks.get(match.reservation.matchId);
    if (!entry || entry.busy) return;
    entry.busy = true;
    entry.sentAt = Date.now();
    const state = entry.state;
    try {
      await options.lifecycle(
        match.reservation.matchId,
        match.reservation.runtimeId,
        state,
        match.outcome,
      );
      entry.confirmedAt = Date.now();
    } catch {
      reject("LIFECYCLE_UNAVAILABLE");
    } finally {
      entry.busy = false;
    }
  }
  const http = createServer(async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(closing ? 503 : 200);
      res.end(
        JSON.stringify({
          ok: !closing,
          protocol: 3,
          matches: matches.size,
          serverEpoch,
        }),
      );
      return;
    }
    if (req.url === "/ready" && req.method === "GET") {
      const ready =
        !closing &&
        matches.size < LIMITS.maxMatches &&
        wss.clients.size < LIMITS.maxConnections;
      res.writeHead(ready ? 200 : 503, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          status: ready ? "ready" : "degraded",
          matches: matches.size,
          connections: wss.clients.size,
          capacity: LIMITS.maxMatches,
        }),
      );
      return;
    }
    if (req.url === "/version" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=60",
      });
      res.end(
        JSON.stringify({ service: "twoplayer-game-server", protocol: 3 }),
      );
      return;
    }
    if (req.url === "/metrics" && req.method === "GET") {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        JSON.stringify({
          service: "twoplayer-game-server",
          ...metrics,
          activeMatches: matches.size,
          activeConnections: wss.clients.size,
        }),
      );
      return;
    }
    try {
      if (closing || req.url !== "/control" || req.method !== "POST")
        throw new GameError("UNAUTHORIZED");
      if (!admission.consume(Date.now())) throw new GameError("RATE_LIMITED");
      const claims = verifyToken(
        await readBody(req),
        options.controlSecret,
        controlClaimsSchema,
      );
      if (claims.reservation.serverEpoch !== serverEpoch)
        throw new GameError("MATCH_UNAVAILABLE");
      replay.consume(claims.jti, claims.exp, Date.now());
      let match = matches.get(claims.reservation.matchId);
      if (
        match &&
        JSON.stringify(match.reservation) !== JSON.stringify(claims.reservation)
      )
        throw new GameError("MATCH_UNAVAILABLE");
      if (claims.action === "reserve") {
        if (!match) {
          if (matches.size >= LIMITS.maxMatches)
            throw new GameError("SERVER_UNAVAILABLE");
          if (Date.now() - claims.reservation.createdAt > config.startupMs)
            throw new GameError("MATCH_UNAVAILABLE");
          callbacks.set(claims.reservation.matchId, {
            state: "WAITING_FOR_PLAYERS",
            confirmedAt: Date.now(),
            sentAt: 0,
            busy: false,
          });
          match = new MatchInstance(
            claims.reservation as import("../../src/game/shared/protocol").Reservation,
            Date.now,
            (state) => {
              const e = callbacks.get(claims.reservation.matchId);
              if (e) {
                e.state = state;
                e.sentAt = 0;
              }
            },
            config,
            options.pve ?? { profile: "phase6-production" },
          );
          matches.set(claims.reservation.matchId, match);
        }
        if (terminalState(match.state))
          throw new GameError("MATCH_UNAVAILABLE");
      } else match?.end();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch (error) {
      const code =
        error instanceof GameError ? error.code : "SERVER_UNAVAILABLE";
      reject(code);
      res.writeHead(code === "SERVER_UNAVAILABLE" ? 503 : 403, {
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ ok: false, code }));
    }
  });
  http.headersTimeout = 5000;
  http.requestTimeout = 8000;
  http.keepAliveTimeout = 3000;
  const wss = new WebSocketServer({
    noServer: true,
    maxPayload: LIMITS.payloadBytes,
    perMessageDeflate: false,
  });
  http.on("upgrade", (req, socket, head) => {
    if (
      closing ||
      req.url !== "/gameplay" ||
      !options.origins.includes(req.headers.origin ?? "") ||
      wss.clients.size >= LIMITS.maxConnections ||
      !admission.consume(Date.now())
    ) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws));
    metrics.connectionsAccepted++;
  });
  wss.on("connection", (ws) => {
    let match: MatchInstance | undefined,
      playerId = "",
      lastSeen = Date.now(),
      joining = false;
    const frameBudget = new RateBudget(60, 90, Date.now());
    // Commands are always rejected when invalid. Only sustained violations
    // disconnect: occasional delayed TCP bursts must not accumulate forever.
    const violationBudget = new RateBudget(
      LIMITS.violationRefillRate,
      LIMITS.violationBurst,
      Date.now(),
    );
    const peer: Peer = {
      send(message: ServerMessage) {
        if (ws.readyState !== WebSocket.OPEN) return;
        if (ws.bufferedAmount > 65536) {
          ws.close(1013, "Slow connection");
          return;
        }
        ws.send(JSON.stringify(message));
      },
      close() {
        ws.close(1000, "Session ended");
      },
    };
    const handshake = setTimeout(() => {
      if (!playerId) ws.close(1008, "Handshake timed out");
    }, LIMITS.handshakeMs);
    const heartbeat = setInterval(() => {
      if (Date.now() - lastSeen > LIMITS.silenceMs) ws.terminate();
      else ws.ping();
    }, LIMITS.heartbeatMs);
    ws.on("pong", () => {
      lastSeen = Date.now();
    });
    ws.on("message", (raw, isBinary) => {
      try {
        if (isBinary || !frameBudget.consume(Date.now()))
          throw new GameError(isBinary ? "INVALID_MESSAGE" : "RATE_LIMITED");
        const message = parseClientMessage(raw.toString());
        lastSeen = Date.now();
        if (!playerId) {
          if (message.type !== "join" || joining)
            throw new GameError("UNAUTHORIZED");
          joining = true;
          const claims = verifyToken(
            message.token,
            options.joinSecret,
            joinClaimsSchema,
          );
          match = matches.get(claims.matchId);
          if (!match) throw new GameError("MATCH_UNAVAILABLE");
          replay.consume(claims.jti, claims.exp, Date.now());
          playerId = match.join(claims, peer);
          metrics.handshakesSucceeded++;
          clearTimeout(handshake);
        } else {
          if (message.type === "join") throw new GameError("TOKEN_USED");
          match!.command(playerId, peer, message);
        }
      } catch (error) {
        const code =
          error instanceof GameError ? error.code : "SERVER_UNAVAILABLE";
        reject(code);
        metrics.commandsRejected++;
        peer.send(
          playerId
            ? { v: 3, type: "connectionWarning", code }
            : { v: 3, type: "serverError", code },
        );
        const repeatedViolation =
          ["INVALID_MESSAGE", "PROTOCOL_MISMATCH", "RATE_LIMITED"].includes(
            code,
          ) && !violationBudget.consume(Date.now());
        if (!playerId || code === "PROTOCOL_MISMATCH" || repeatedViolation)
          ws.close(1008, "Connection rejected");
      }
    });
    ws.on("error", () => reject("SOCKET_ERROR"));
    ws.on("close", () => {
      clearTimeout(handshake);
      clearInterval(heartbeat);
      match?.disconnect(playerId, peer);
    });
  });
  const accumulator = new FixedAccumulator(1 / config.tickRate);
  let last = performance.now();
  const simulation = setInterval(
    () => {
      const now = performance.now();
      accumulator.advance((now - last) / 1000, () => {
        for (const match of matches.values()) {
          try {
            const began = performance.now();
            match.step();
            match.pve.metrics.tickMs = performance.now() - began;
            metrics.ticks++;
            metrics.tickDurationMs = match.pve.metrics.tickMs;
            match.pve.metrics.tickDriftMs = accumulator.droppedSeconds * 1000;
            metrics.tickDriftMs = match.pve.metrics.tickDriftMs;
            if (match.pve.metrics.tickMs > 1000 / config.tickRate)
              reject("TICK_BUDGET_EXCEEDED");
          } catch {
            reject("SIMULATION_ERROR");
            match.fail();
          }
        }
      });
      last = now;
    },
    1000 / config.tickRate / 2,
  );
  const maintenance = setInterval(() => {
    for (const [id, match] of matches) {
      const entry = callbacks.get(id)!;
      if (Date.now() - entry.confirmedAt > LIMITS.leaseMs - 5000) match.fail();
      if (Date.now() - entry.sentAt >= LIMITS.leaseRenewMs) void persist(match);
      if (
        terminalState(match.state) &&
        Date.now() - match.endedAt > LIMITS.leaseMs
      ) {
        match.dispose();
        matches.delete(id);
        callbacks.delete(id);
      }
    }
    if (rejected.size) {
      console.warn(
        JSON.stringify({
          event: "gameplay_diagnostics",
          rejected: Object.fromEntries(rejected),
          droppedSimulationSeconds: accumulator.droppedSeconds,
        }),
      );
      rejected.clear();
    }
  }, 1000);
  return {
    http,
    matches,
    async close() {
      closing = true;
      clearInterval(simulation);
      clearInterval(maintenance);
      for (const match of matches.values()) {
        match.end();
        await persist(match);
        match.dispose();
      }
      for (const ws of wss.clients) ws.terminate();
      matches.clear();
      callbacks.clear();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      if (http.listening)
        await new Promise<void>((resolve) => http.close(() => resolve()));
    },
  };
}
