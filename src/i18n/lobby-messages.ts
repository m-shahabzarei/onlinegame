import type { LobbyErrorCode, LobbySnapshot } from "@/domain/lobby";
import { createTranslator } from "./client";
import type { Locale } from "./messages";

const errors = {
  INVALID_INPUT: "lobbyInvalidInput",
  UNAUTHENTICATED: "lobbyUnauthenticated",
  FORBIDDEN: "lobbyForbidden",
  ROOM_UNAVAILABLE: "lobbyUnavailable",
  ROOM_FULL: "lobbyFull",
  ROOM_CLOSED: "lobbyClosed",
  ROOM_EXPIRED: "lobbyExpired",
  ROOM_KICKED: "lobbyKicked",
  MEMBERSHIP_ENDED: "lobbyMembershipEnded",
  ALREADY_IN_ROOM: "lobbyAlreadyInRoom",
  GAME_UNAVAILABLE: "lobbyGameUnavailable",
  INVALID_TRANSITION: "lobbyInvalidState",
  NOT_READY: "lobbyNotReady",
  STALE_STATE: "lobbyStale",
  IDEMPOTENCY_CONFLICT: "lobbyDuplicate",
  RATE_LIMITED: "lobbyRateLimited",
  SERVICE_UNAVAILABLE: "lobbyServiceUnavailable",
} as const satisfies Record<LobbyErrorCode, string>;
export function lobbyErrorMessage(locale: Locale, code: string): string {
  const t = createTranslator(locale);
  return t(`platform.${errors[code as LobbyErrorCode] ?? "lobbyNetwork"}`);
}
export function lobbyStartBlocker(
  locale: Locale,
  room: LobbySnapshot,
): string | null {
  const t = createTranslator(locale);
  if (!room.startBlocker) return null;
  if (room.members.length < room.maxPlayers)
    return t("platform.invitePlayerBlocker", {
      count: room.members.length,
      maximum: room.maxPlayers,
    });
  if (room.members.some((m) => m.connection !== "CONNECTED"))
    return t(
      room.maxPlayers === 1
        ? "platform.connectSoloBlocker"
        : "platform.connectCoopBlocker",
    );
  return t(
    room.maxPlayers === 1
      ? "platform.readySoloBlocker"
      : "platform.readyCoopBlocker",
  );
}
