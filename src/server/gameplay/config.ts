import "server-only";
import { z } from "zod";
export function gameplayWebConfig(env = process.env) {
  const parsed = z
    .object({
      GAMEPLAY_JOIN_SECRET: z.string().min(32),
      GAMEPLAY_CONTROL_SECRET: z.string().min(32),
      GAMEPLAY_SERVER_HTTP_URL: z.url(),
      GAMEPLAY_WS_URL: z.url(),
    })
    .parse(env);
  const http = new URL(parsed.GAMEPLAY_SERVER_HTTP_URL),
    ws = new URL(parsed.GAMEPLAY_WS_URL);
  if (
    !["http:", "https:"].includes(http.protocol) ||
    !["ws:", "wss:"].includes(ws.protocol) ||
    http.username ||
    http.password ||
    ws.username ||
    ws.password ||
    ws.search ||
    ws.hash
  )
    throw new Error("Invalid gameplay URL configuration");
  if (
    env.NODE_ENV === "production" &&
    (http.protocol !== "https:" || ws.protocol !== "wss:")
  )
    throw new Error("Production gameplay requires TLS");
  return {
    joinSecret: parsed.GAMEPLAY_JOIN_SECRET,
    controlSecret: parsed.GAMEPLAY_CONTROL_SECRET,
    httpUrl: http.href,
    wsUrl: ws.href,
  };
}
