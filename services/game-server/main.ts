import { serverConfig } from "./config";
import { createGameplayService } from "./server";
import { signToken, tokenTimes } from "../../src/game/shared/tokens";
async function main() {
  const config = serverConfig(process.env);
  const service = await createGameplayService({
    ...config,
    async lifecycle(matchId, runtimeId, state, outcome) {
      const token = signToken(
        {
          ...tokenTimes(),
          aud: "twoplayer-lifecycle",
          matchId,
          runtimeId,
          state,
          ...(outcome ? { outcome } : {}),
        },
        config.controlSecret,
      );
      const response = await fetch(
        new URL("/api/gameplay/internal", config.webUrl),
        {
          method: "POST",
          headers: { "Content-Type": "text/plain" },
          body: token,
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) throw new Error("Lifecycle callback rejected");
    },
  });
  service.http.listen(config.port, config.host, () =>
    console.info(
      JSON.stringify({
        event: "gameplay_listening",
        port: config.port,
        protocol: 2,
        tickRate: config.simulation.tickRate,
        snapshotRate: config.simulation.snapshotRate,
      }),
    ),
  );
  let stopping = false;
  const stop = () => {
    if (stopping) return;
    stopping = true;
    void service.close().then(() => process.exit(0));
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}
void main().catch(() => {
  console.error(JSON.stringify({ event: "gameplay_startup_failed" }));
  process.exitCode = 1;
});
