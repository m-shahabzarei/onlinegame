"use client";
import { useTranslations } from "@/i18n/provider";

import { useEffect, useState } from "react";
import type { PresenceSummary as Summary } from "@/domain/lobby";
import { lobbyRequest } from "./client";
export function PresenceSummary({ signedIn }: { signedIn: boolean }) {
  const t = useTranslations();

  const [summary, setSummary] = useState<Summary | null>(null);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let failures = 0;
    const controller = new AbortController();
    async function refresh() {
      try {
        if (signedIn)
          await lobbyRequest(
            { op: "heartbeat" },
            { code: null },
            controller.signal,
          );
        const value = await lobbyRequest<Summary>(
          { op: "presence" },
          undefined,
          controller.signal,
        );
        if (!stopped) setSummary(value);
        failures = 0;
      } catch {
        if (!stopped) setSummary(null);
        failures++;
      }
      if (!stopped && failures < 5)
        timer = setTimeout(
          () => void refresh(),
          Math.min(15_000 * 2 ** failures, 60_000),
        );
    }
    void refresh();
    return () => {
      stopped = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [signedIn]);
  return (
    <p
      className="text-muted-foreground text-xs"
      role="status"
      aria-live="polite"
    >
      {summary
        ? t("platform.presence", {
            online: summary.online,
            lobby: summary.inLobby,
          })
        : t("platform.presenceUnavailable")}
    </p>
  );
}
