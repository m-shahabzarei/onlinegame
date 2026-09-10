import "server-only";
import { getServerEnv } from "@/config/server-env";
import { LobbyError } from "@/domain/lobby";
import { AblyServerAdapter } from "@/realtime/ably-server";
import { LocalRealtimePublisher } from "@/realtime/local-publisher";
import {
  LocalEphemeralStore,
  RedisEphemeralStore,
  type EphemeralStore,
} from "./ephemeral";
import { LocalRoomStateStore } from "./store";
import { PrismaRoomStateStore } from "./prisma-store";
import { LobbyRoomService } from "./room-service";

interface LobbyRuntime {
  service: LobbyRoomService;
  ephemeral: EphemeralStore;
  provider: AblyServerAdapter | null;
}
const runtimeKey = Symbol.for("twoplayer.lobby.runtime");
const globals = globalThis as typeof globalThis & {
  [runtimeKey]?: LobbyRuntime;
};
export function getLobbyRuntime(): LobbyRuntime {
  if (globals[runtimeKey]) return globals[runtimeKey];
  const env = getServerEnv();
  if (
    env.realtime.provider === "local" &&
    env.auth.mode === "development" &&
    process.env.NODE_ENV !== "production"
  ) {
    const ephemeral = new LocalEphemeralStore();
    return (globals[runtimeKey] = {
      ephemeral,
      service: new LobbyRoomService(
        new LocalRoomStateStore(),
        ephemeral,
        new LocalRealtimePublisher(),
      ),
      provider: null,
    });
  }
  if (
    env.realtime.provider !== "ably" ||
    env.auth.mode !== "database" ||
    !env.realtime.apiKey ||
    !env.realtime.redisUrl ||
    !env.realtime.redisToken
  )
    throw new LobbyError("SERVICE_UNAVAILABLE");
  const ephemeral = new RedisEphemeralStore(
    env.realtime.redisUrl,
    env.realtime.redisToken,
  );
  const provider = new AblyServerAdapter(env.realtime.apiKey);
  return (globals[runtimeKey] = {
    ephemeral,
    provider,
    service: new LobbyRoomService(
      new PrismaRoomStateStore(),
      ephemeral,
      provider,
    ),
  });
}
