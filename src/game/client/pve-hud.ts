import {
  emptyWave,
  type LifeState,
  type PvEMetrics,
  type WaveSnapshot,
} from "../shared/pve";
import type { Phase6PlayerState, ShopResultCode } from "../shared/phase6";
import type { CombatNotice, DamageDirection } from "./messages";
export interface ShopFeedback {
  requestId: string;
  code: ShopResultCode;
  weaponId?: string | undefined;
  kind?: "weapon" | "ammo" | "upgrade" | "equip" | undefined;
}
export interface PvEHud {
  wave: WaveSnapshot;
  life: LifeState;
  maxHealth: number;
  bleedOutSeconds: number;
  teammateLife: LifeState;
  teammateHealth: number;
  intermission: number;
  revivePrompt: boolean;
  reviveProgress: number;
  reviving: boolean;
  recoveryPending: boolean;
  feedback: CombatNotice | null;
  damageDirection: DamageDirection | null;
  shopVisible: boolean;
  shopSeconds: number;
  shopFeedback: ShopFeedback | null;
  shopPending: boolean;
  loadout: Phase6PlayerState | null;
  pooledZombies: number;
  activeZombies: number;
  zombieCorrections: number;
  pveMetrics: PvEMetrics | null;
  pathRequestsPerSecond: number;
  scrap: number;
  score: number;
  contribution: number;
  armor: number;
  medkits: number;
  grenades: number;
  sentries: number;
  shopOpen: boolean;
  shopUntil: number;
  bossHealth: number;
  bossMaxHealth: number;
  bossPhase: number;
  bossActive: boolean;
  phase6Outcome: "ACTIVE" | "VICTORY" | "DEFEAT" | null;
  ownedWeapons: string[];
  equippedWeapon: string;
  phase6Profile: "phase5-test" | "phase6-production";
}
export const INITIAL_PVE_HUD: PvEHud = {
  wave: emptyWave(),
  life: "ALIVE",
  maxHealth: 100,
  bleedOutSeconds: 0,
  teammateLife: "ALIVE",
  teammateHealth: 100,
  intermission: 0,
  revivePrompt: false,
  reviveProgress: 0,
  reviving: false,
  recoveryPending: false,
  feedback: null,
  damageDirection: null,
  shopVisible: false,
  shopSeconds: 0,
  shopFeedback: null,
  shopPending: false,
  loadout: null,
  pooledZombies: 48,
  activeZombies: 0,
  zombieCorrections: 0,
  pveMetrics: null,
  pathRequestsPerSecond: 0,
  scrap: 0,
  score: 0,
  contribution: 0,
  armor: 0,
  medkits: 0,
  grenades: 0,
  sentries: 0,
  shopOpen: false,
  shopUntil: 0,
  bossHealth: 0,
  bossMaxHealth: 0,
  bossPhase: 0,
  bossActive: false,
  phase6Outcome: null,
  ownedWeapons: ["ar-01"],
  equippedWeapon: "ar-01",
  phase6Profile: "phase6-production",
};
