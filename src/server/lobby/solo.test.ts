// @vitest-environment node
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LocalRealtimePublisher } from "@/realtime/local-publisher";
import { LobbyRoomService } from "./room-service";
import { LocalEphemeralStore } from "./ephemeral";
import { LocalRoomStateStore } from "./store";

describe("solo lobby mode", () => {
  it("creates, readies, and starts with one host", async () => {
    const store = new LocalRoomStateStore();
    const presence = new LocalEphemeralStore();
    const service = new LobbyRoomService(
      store,
      presence,
      new LocalRealtimePublisher(),
    );
    const identity = {
      id: "solo",
      displayName: "Solo",
      avatarUrl: null,
      isGuest: false,
    };
    const created = await service.execute(identity, {
      type: "create",
      slug: "nightfall-protocol",
      visibility: "PRIVATE",
      mode: "solo",
      requestId: randomUUID(),
    });
    expect(created.room).toMatchObject({ mode: "solo", maxPlayers: 1 });
    await service.heartbeat(identity.id, created.code);
    const room = await service.snapshot(identity.id, created.code);
    const ready = await service.execute(identity, {
      type: "ready",
      code: created.code,
      expectedVersion: room.stateVersion,
      ready: true,
      requestId: randomUUID(),
    });
    expect(ready.room?.startBlocker).toBeNull();
    const started = await service.execute(identity, {
      type: "start",
      code: created.code,
      expectedVersion: ready.room!.stateVersion,
      requestId: randomUUID(),
    });
    expect(started.room?.status).toBe("STARTING");
  });
});
