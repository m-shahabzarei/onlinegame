import "server-only";
import { z } from "zod";
import { signToken, tokenTimes } from "@/game/shared/tokens";
import type { Reservation } from "@/game/shared/protocol";
import { getLobbyRuntime } from "@/server/lobby";
import { gameplayWebConfig } from "./config";
import { GameplayBootstrapService } from "./service";
export function getGameplayService() {
  const config = gameplayWebConfig();
  async function control(
    action: "reserve" | "cancel",
    reservation: Reservation,
  ) {
    const token = signToken(
      { ...tokenTimes(), aud: "twoplayer-control", action, reservation },
      config.controlSecret,
    );
    const response = await fetch(new URL("/control", config.httpUrl), {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: token,
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error("Gameplay provisioning failed");
  }
  return new GameplayBootstrapService(
    getLobbyRuntime().service.store,
    {
      async epoch() {
        const response = await fetch(new URL("/health", config.httpUrl), {
          cache: "no-store",
          signal: AbortSignal.timeout(5000),
        });
        if (!response.ok) throw new Error("Gameplay unavailable");
        return z.object({ serverEpoch: z.uuid() }).parse(await response.json())
          .serverEpoch;
      },
      reserve: (r) => control("reserve", r),
      cancel: (r) => control("cancel", r),
    },
    config.joinSecret,
    config.wsUrl,
  );
}
