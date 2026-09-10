import type { MatchState } from "./protocol";
const allowed: Record<MatchState, readonly MatchState[]> = {
  BOOTSTRAPPING: ["WAITING_FOR_PLAYERS", "ERROR", "CANCELLED"],
  WAITING_FOR_PLAYERS: ["LOADING", "CANCELLED", "ERROR"],
  LOADING: ["COUNTDOWN", "WAITING_FOR_PLAYERS", "CANCELLED", "ERROR"],
  COUNTDOWN: [
    "PLAYING",
    "LOADING",
    "WAITING_FOR_PLAYERS",
    "CANCELLED",
    "ERROR",
  ],
  PLAYING: ["RECONNECTING", "BOSS_INTRO", "ENDED", "ERROR"],
  BOSS_INTRO: ["BOSS_ACTIVE", "RECONNECTING", "ENDED", "ERROR"],
  BOSS_ACTIVE: ["RECONNECTING", "ENDED", "ERROR"],
  RECONNECTING: ["PLAYING", "ENDED", "ERROR"],
  CANCELLED: [],
  ENDED: [],
  ERROR: [],
};
export const terminalState = (state: MatchState) =>
  state === "CANCELLED" || state === "ENDED" || state === "ERROR";
export function transition(current: MatchState, next: MatchState) {
  if (current === next) return current;
  if (!allowed[current].includes(next))
    throw new Error(`Invalid match transition: ${current} -> ${next}`);
  return next;
}
