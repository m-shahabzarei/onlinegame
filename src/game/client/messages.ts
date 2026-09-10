/** Semantic presentation notices; gameplay/network code never builds UI prose. */
import type { Archetype } from "../shared/pve";
export type CombatNotice =
  | { code: "waveBegins"; number: number }
  | {
      code:
        | "waveCleared"
        | "complete"
        | "defeated"
        | "eliminated"
        | "headshot"
        | "hit"
        | "scream"
        | "brute"
        | "spitter"
        | "revived"
        | "interrupted";
    };
export type DamageDirection =
  "damageFront" | "damageBack" | "damageLeft" | "damageRight";
export type RuntimeErrorCode =
  | "GRAPHICS_LOST"
  | "POINTER_LOCK_DENIED"
  | "SESSION_ENDED"
  | "SESSION_CANCELLED"
  | "SERVER_ENDED"
  | "UNAUTHORIZED"
  | "MATCH_UNAVAILABLE"
  | "SERVER_UNAVAILABLE"
  | "INSECURE_CONNECTION"
  | "SLOT_CONNECTED"
  | "CONNECTION_REJECTED"
  | "PROTOCOL_MISMATCH"
  | "RECOVERY_TIMEOUT"
  | "RECONNECTING"
  | "AUDIO_UNAVAILABLE";

export interface ArenaPresentation {
  signs: readonly [string, string, string];
  zombieLabels: Readonly<Record<Archetype, string>>;
  teammateLabel: (state: {
    name: string;
    connected: boolean;
    life: string;
    health: number;
  }) => string;
}
