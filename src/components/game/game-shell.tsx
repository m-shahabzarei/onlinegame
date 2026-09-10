"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Crosshair, Heart, Settings2, Signal, UsersRound } from "lucide-react";
import {
  Button,
  buttonVariants,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type GameSettings,
} from "@/game/shared/settings";
import { resolveWeaponStats } from "@/game/shared/phase6";
import type { GameRuntime, HudState } from "@/game/client/runtime";
import type { ArenaPresentation } from "@/game/client/messages";
import { INITIAL_PVE_HUD } from "@/game/client/pve-hud";
import { terminalState } from "@/game/shared/lifecycle";
import { createTranslator, formatNumber } from "@/i18n/client";
import type { Locale } from "@/i18n/messages";
import styles from "./game.module.css";
import { Phase6Shop, shopFeedbackText } from "./phase6-shop";

const initial: HudState = {
  ...INITIAL_PVE_HUD,
  connection: "Connecting",
  mode: "coop",
  state: "BOOTSTRAPPING",
  error: "",
  locked: false,
  contextLost: false,
  health: 100,
  magazine: 30,
  reserve: 120,
  reloading: false,
  teammate: "",
  teammateConnected: false,
  countdown: 0,
  hit: false,
  ping: 0,
  fps: 0,
  frameMs: 0,
  serverTick: 0,
  snapshotAge: 0,
  predictionError: 0,
  corrections: 0,
  maxCorrection: 0,
  inputLatency: 0,
  inbound: 0,
  outbound: 0,
  inboundBytes: 0,
  outboundBytes: 0,
  drawCalls: 0,
  triangles: 0,
};
type WeaponId =
  keyof typeof import("@/i18n/game-messages").gameMessages.en.weaponNames;
export function GameShell({
  matchId,
  preferences,
  locale = "en",
}: {
  matchId: string;
  preferences: { reducedMotion: boolean; soundEnabled: boolean };
  locale?: Locale;
}) {
  const router = useRouter();
  const [startupAttempt, setStartupAttempt] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameRuntime | null>(null),
    enter = useRef<HTMLButtonElement>(null),
    shopButton = useRef<HTMLButtonElement>(null);
  const [hud, setHud] = useState(initial),
    [status, setStatus] = useState<
      "loading" | "ready" | "unsupported" | "failed"
    >("loading"),
    [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS),
    [settingsOpen, setSettingsOpen] = useState(false),
    [leaveOpen, setLeaveOpen] = useState(false),
    [diagnostics, setDiagnostics] = useState(false);
  const t = createTranslator(locale);
  const n = (value: number) =>
    formatNumber(locale, value, { maximumFractionDigits: 0 });
  const presentation = useMemo<ArenaPresentation>(() => {
    const translate = createTranslator(locale);
    return {
      signs: [
        translate("arena.signQuarantine"),
        translate("arena.signNorth"),
        translate("arena.signHostiles"),
      ],
      zombieLabels: {
        walker: translate("zombieNames.walker"),
        runner: translate("zombieNames.runner"),
        spitter: translate("zombieNames.spitter"),
        brute: translate("zombieNames.brute"),
        screamer: translate("zombieNames.screamer"),
      },
      teammateLabel: (player) =>
        `\u2068${player.name}\u2069 · ${!player.connected ? translate("connectionStates.Reconnecting") : player.life === "DOWNED" ? translate("arena.teammateRevive") : translate("arena.healthValue", { count: player.health })}`,
    };
  }, [locale]);
  const presentationRef = useRef(presentation);
  useEffect(() => {
    presentationRef.current = presentation;
    engine.current?.presentation(presentation);
  }, [presentation]);
  useEffect(() => {
    let cancelled = false;
    let instance: GameRuntime | null = null;
    (async () => {
      const el = canvas.current;
      if (!el) return;
      if (
        !("requestPointerLock" in el) ||
        !window.matchMedia("(pointer:fine)").matches ||
        !window.WebSocket
      ) {
        setStatus("unsupported");
        return;
      }
      let saved: GameSettings;
      try {
        saved = loadSettings(
          {
            reducedMotion: preferences.reducedMotion,
            soundEnabled: preferences.soundEnabled,
          },
          localStorage,
          window.matchMedia("(prefers-reduced-motion: reduce)").matches,
        );
      } catch {
        saved = {
          ...DEFAULT_SETTINGS,
          reducedMotion: preferences.reducedMotion,
          volume: preferences.soundEnabled ? 0.4 : 0,
        };
      }
      setSettings(saved);
      try {
        const { GameRuntime } = await import("@/game/client/runtime");
        instance = await GameRuntime.create(
          el,
          saved,
          (update) => !cancelled && setHud(update),
          matchId,
          presentationRef.current,
        );
        if (cancelled) {
          instance.dispose();
          return;
        }
        engine.current = instance;
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
      instance?.dispose();
      engine.current = null;
    };
  }, [
    matchId,
    preferences.reducedMotion,
    preferences.soundEnabled,
    startupAttempt,
  ]);
  useEffect(() => {
    engine.current?.setMenuOpen(settingsOpen || leaveOpen);
  }, [settingsOpen, leaveOpen]);
  const terminal = terminalState(hud.state);
  const weapon = resolveWeaponStats(
    hud.equippedWeapon,
    hud.loadout?.upgrades[hud.equippedWeapon] ?? 0,
  );
  const title =
    status === "unsupported"
      ? t("arena.desktop")
      : status === "failed"
        ? t("arena.failed")
        : status === "loading"
          ? t("loading.gameplay")
          : terminal
            ? hud.phase6Outcome === "VICTORY"
              ? t("arena.victory")
              : hud.phase6Outcome === "DEFEAT" ||
                  hud.wave.state === "TEAM_DEFEATED"
                ? t("arena.defeated")
                : hud.wave.state === "PHASE_COMPLETE"
                  ? t("arena.complete")
                  : t("arena.ended")
            : hud.state === "WAITING_FOR_PLAYERS"
              ? t(hud.mode === "solo" ? "arena.preparingSolo" : "arena.waiting")
              : hud.state === "LOADING"
                ? t(
                    hud.mode === "solo"
                      ? "arena.preparing"
                      : "arena.teammateLoading",
                  )
                : hud.state === "COUNTDOWN"
                  ? t("arena.countdown", { count: hud.countdown })
                  : t("arena.enterTitle");
  const description =
    status === "unsupported"
      ? t("arena.desktopHelp")
      : status === "failed"
        ? t("arena.graphicsHelp")
        : terminal
          ? t("arena.endedHelp")
          : t(hud.mode === "solo" ? "arena.soloHelp" : "arena.coopHelp");
  const restoreArenaFocus = () => {
    (shopButton.current ?? enter.current ?? canvas.current)?.focus();
  };
  const leave = async () => {
    try {
      await engine.current?.leave();
    } finally {
      router.push("/games/nightfall-protocol/rooms");
    }
  };
  const updateSetting = (next: GameSettings) => {
    setSettings(next);
    engine.current?.configure(next);
  };
  return (
    <main
      id="main-content"
      className={styles.game}
      aria-label={t("arena.label")}
    >
      <canvas
        ref={canvas}
        tabIndex={-1}
        className={styles.canvas}
        aria-label={t("arena.canvas")}
      />
      <div className={styles.top}>
        <div className={styles.panel}>
          <span className={styles.eyebrow}>{t("arena.nightfall")}</span>
          <strong>
            {t("arena.yard")}{" "}
            <span className={styles.tag}>{t("arena.survival")}</span>
          </strong>
          <span className={styles.wave}>
            {t("arena.wave", {
              number: hud.wave.number || 1,
              total: hud.phase6Profile === "phase6-production" ? 10 : 5,
            })}{" "}
            ·{" "}
            {hud.bossActive
              ? t("arena.boss")
              : t(`waveStates.${hud.wave.state}`)}
          </span>
        </div>
        <div className={`${styles.panel} ${styles.connection}`}>
          <Signal size={17} aria-hidden="true" />
          <span>{t(`connectionStates.${hud.connection}`)}</span>
          <span className={styles.mono}>
            {t("arena.ping", { count: Math.round(hud.ping) })}
          </span>
          <Button
            variant="ghost"
            className="min-h-11 min-w-11"
            onClick={() => {
              engine.current?.pause();
              setSettingsOpen(true);
            }}
            aria-label={t("arena.openSettings")}
          >
            <Settings2 aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {t(`connectionStates.${hud.connection}`)}. {title}
      </p>
      {hud.shopOpen && !terminal && (
        <div className={styles.shopNotice}>
          <strong role="status">{t("gameShop.available")}</strong>
          <span role="timer" aria-live="off">
            {t("gameShop.countdown", { count: hud.shopSeconds })}
          </span>
          <Button
            ref={shopButton}
            className="min-h-11 min-w-11"
            onClick={() => engine.current?.openShop()}
          >
            {t("gameShop.open")}
          </Button>
        </div>
      )}
      {status === "ready" && !terminal && (
        <div className={styles.combatStatus}>
          {hud.life === "DOWNED" && (
            <div className={styles.lifeNotice} role="status">
              <strong>
                {t(
                  hud.mode === "solo" ? "arena.downedSolo" : "arena.downedCoop",
                )}
              </strong>
              <span className={styles.mono}>
                {t("arena.bleedOut", { count: hud.bleedOutSeconds })}
              </span>
              <span>
                {t(
                  hud.mode === "solo"
                    ? "arena.downedSoloHelp"
                    : "arena.downedCoopHelp",
                )}
              </span>
            </div>
          )}
          {hud.recoveryPending && (
            <p className={styles.lifeNotice}>
              {t(
                hud.mode === "solo"
                  ? "arena.recoverySolo"
                  : "arena.recoveryCoop",
              )}
            </p>
          )}
          {hud.revivePrompt && !hud.reviving && (
            <p className={styles.revive}>{t("arena.revivePrompt")}</p>
          )}
          {hud.reviving && (
            <div className={styles.revive}>
              <span>{t("arena.reviveProgress")}</span>
              <progress
                aria-label={t("arena.reviveProgress")}
                value={hud.reviveProgress}
                max={1}
              />
            </div>
          )}
          {hud.feedback && (
            <p className={styles.feedback} role="status">
              {hud.feedback.code === "waveBegins"
                ? t("arena.waveBegins", { number: hud.feedback.number })
                : t(`arena.${hud.feedback.code}`)}
            </p>
          )}
          {hud.damageDirection && (
            <p className={styles.damage} role="status">
              {t(`arena.${hud.damageDirection}`)}
            </p>
          )}
          {hud.bossActive && (
            <div className={styles.lifeNotice}>
              <strong>
                {t("arena.boss")} ·{" "}
                {t("arena.bossPhase", { count: hud.bossPhase })}
              </strong>
              <progress
                aria-label={t("arena.boss")}
                value={hud.bossHealth}
                max={hud.bossMaxHealth}
              />
            </div>
          )}
        </div>
      )}
      {hud.locked && hud.life === "ALIVE" && !hud.shopVisible && (
        <div
          className={`${styles.crosshair} ${hud.hit ? styles.hit : ""}`}
          style={{ scale: 1 + Math.min(weapon.spread * 12, 0.9) }}
          aria-hidden="true"
        >
          <span />
          <span />
          <span />
          <span />
          {hud.hit && <b>×</b>}
        </div>
      )}
      <div className={styles.bottom}>
        <div className={styles.panel}>
          <span className={styles.eyebrow}>
            <Heart size={14} aria-hidden="true" />
            {t("arena.vitals")}
          </span>
          <div className={styles.health}>
            <strong className={styles.mono}>{n(hud.health)}</strong>
            <span>{t(`lifeStates.${hud.life}`)}</span>
          </div>
          <progress
            className={styles.healthBar}
            aria-label={t("arena.health")}
            value={hud.health}
            max={hud.maxHealth}
          />
          <span className={styles.wave}>
            {t("arena.scrap", { count: hud.scrap })}
          </span>
        </div>
        <div className={`${styles.panel} ${styles.teammate}`}>
          <span className={styles.eyebrow}>
            <UsersRound size={14} aria-hidden="true" />
            {t(hud.mode === "solo" ? "arena.mode" : "arena.teammate")}
          </span>
          <strong dir="auto">
            {hud.mode === "solo"
              ? t("arena.solo")
              : hud.teammate || t("arena.waiting")}
          </strong>
          <span>
            {hud.mode === "solo"
              ? t("arena.soloAuthority")
              : hud.teammateConnected
                ? `${t("arena.healthValue", { count: hud.teammateHealth })} · ${t(`lifeStates.${hud.teammateLife}`)}`
                : t("arena.waitingConnection")}
          </span>
          <span>
            {t("arena.score", { count: hud.score })} ·{" "}
            {t("arena.contribution", { count: hud.contribution })}
          </span>
        </div>
        <div
          className={`${styles.panel} ${styles.ammo}`}
          data-testid="weapon-hud"
          data-weapon={hud.equippedWeapon}
        >
          <span className={styles.eyebrow}>
            {t(`weaponNames.${hud.equippedWeapon as WeaponId}`)}
          </span>
          <div dir="ltr">
            <strong className={styles.mono}>{n(hud.magazine)}</strong>
            <span className={styles.mono}> / {n(hud.reserve)}</span>
          </div>
          <span>
            {hud.reloading
              ? t("arena.reloading")
              : hud.magazine === 0
                ? t("arena.empty")
                : t("arena.reloadHint", {
                    mode: t(`fireModes.${weapon.fireMode}`),
                  })}
          </span>
          <span>{t("arena.switches")}</span>
        </div>
      </div>
      {(status !== "ready" || !hud.locked || terminal) && !hud.shopVisible && (
        <section className={styles.scrim} aria-labelledby="arena-status">
          <div className={styles.card}>
            <div className={styles.cardIcon}>
              <Crosshair aria-hidden="true" />
            </div>
            <span className={styles.eyebrow}>{t("arena.session")}</span>
            <h1 id="arena-status">{title}</h1>
            <p>{description}</p>
            {hud.error && <p role="alert">{t(`gameErrors.${hud.error}`)}</p>}
            {status === "ready" && !terminal && (
              <Button ref={enter} onClick={() => engine.current?.enter()}>
                {t("arena.enter")}
              </Button>
            )}
            {hud.shopOpen && (
              <Button
                variant="secondary"
                onClick={() => engine.current?.openShop()}
              >
                {t("gameShop.open")}
              </Button>
            )}
            {status === "failed" && (
              <Button
                onClick={() => {
                  setStatus("loading");
                  setStartupAttempt((attempt) => attempt + 1);
                }}
              >
                {t("arena.reloadGame")}
              </Button>
            )}
            {hud.connection === "Failed" && (
              <Button onClick={() => engine.current?.retry()}>
                {t("common.retry")}
              </Button>
            )}
            <div className={styles.actions}>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                href="/games/nightfall-protocol/rooms"
              >
                {t("arena.rooms")}
              </Link>
              {status === "ready" && !terminal && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      engine.current?.pause();
                      setLeaveOpen(true);
                    }}
                  >
                    {t("arena.leave")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => {
                      engine.current?.pause();
                      setSettingsOpen(true);
                    }}
                  >
                    {t("arena.settings")}
                  </Button>
                </>
              )}
            </div>
            {!terminal && (
              <>
                <div
                  className={styles.controls}
                  aria-label={t("arena.controls")}
                >
                  {(
                    [
                      ["WASD", "move"],
                      ["Shift", "sprint"],
                      ["Space", "jump"],
                      ["Ctrl", "crouch"],
                      ["R", "reload"],
                      ["E", "interact"],
                      ["B", "shop"],
                      ["Escape", "pause"],
                    ] as const
                  ).map(([binding, label]) => (
                    <span key={binding}>
                      <kbd dir="ltr">{binding}</kbd>
                      {t(`arena.${label}`)}
                    </span>
                  ))}
                </div>
                <p className={styles.note}>{t("arena.controlsHelp")}</p>
              </>
            )}
            {terminal && (
              <p>
                {t("arena.score", { count: hud.score })} ·{" "}
                {t("arena.contribution", { count: hud.contribution })}
              </p>
            )}
          </div>
        </section>
      )}
      {!hud.shopVisible && hud.shopFeedback && (
        <p className={styles.resultNotice} role="status" aria-live="polite">
          {shopFeedbackText(locale, hud.shopFeedback)}
        </p>
      )}
      <Phase6Shop
        open={hud.shopVisible && hud.shopOpen && !terminal}
        loadout={hud.loadout}
        seconds={hud.shopSeconds}
        wave={hud.wave.number + 1}
        pending={hud.shopPending}
        feedback={hud.shopFeedback}
        onPurchase={(kind, id, replacing) =>
          engine.current?.purchasePhase6(kind, id, replacing)
        }
        onEquip={(id, slot) => engine.current?.equipWeapon(id, slot)}
        onClose={() => engine.current?.closeShop()}
        onReturn={() => engine.current?.enter()}
        restoreFocus={restoreArenaFocus}
        locale={locale}
      />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent
          closeLabel={t("common.close")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreArenaFocus();
          }}
        >
          <DialogTitle>{t("arena.settingsTitle")}</DialogTitle>
          <DialogDescription>{t("arena.settingsHelp")}</DialogDescription>
          {(
            [
              ["sensitivity", 0.2, 3, 0.1],
              ["volume", 0, 1, 0.05],
              ["fov", 65, 105, 1],
            ] as const
          ).map(([key, min, max, step]) => (
            <label key={key} className={styles.setting}>
              <span>
                {t(`arena.${key}`)}
                <output>
                  {formatNumber(locale, settings[key], {
                    maximumFractionDigits: 2,
                  })}
                </output>
              </span>
              <input
                type="range"
                min={min}
                max={max}
                step={step}
                value={settings[key]}
                onChange={(event) =>
                  updateSetting({
                    ...settings,
                    [key]: Number(event.target.value),
                  })
                }
              />
            </label>
          ))}
          {(
            [
              ["reducedMotion", "reduceMotion"],
              ["invertY", "invert"],
              ["screenFlashes", "flashes"],
              ["cameraShake", "cameraShake"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className={styles.check}>
              <span>{t(`arena.${label}`)}</span>
              <input
                type="checkbox"
                checked={settings[key]}
                onChange={(event) =>
                  updateSetting({ ...settings, [key]: event.target.checked })
                }
              />
            </label>
          ))}
          <label className={styles.check}>
            <span>{t("arena.diagnostics")}</span>
            <input
              type="checkbox"
              checked={diagnostics}
              onChange={(event) => setDiagnostics(event.target.checked)}
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => updateSetting(DEFAULT_SETTINGS)}
          >
            {t("arena.defaults")}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent
          closeLabel={t("common.close")}
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restoreArenaFocus();
          }}
        >
          <DialogTitle>{t("arena.leaveTitle")}</DialogTitle>
          <DialogDescription>{t("arena.leaveHelp")}</DialogDescription>
          <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
            {t("arena.stay")}
          </Button>
          <Button variant="destructive" onClick={() => void leave()}>
            {t("arena.leave")}
          </Button>
        </DialogContent>
      </Dialog>
      {process.env.NODE_ENV !== "production" && diagnostics && (
        <pre className={styles.diagnostics} aria-label={t("arena.diagnostics")}>
          {t("arena.diagnosticValue", {
            fps: hud.fps,
            time: formatNumber(locale, hud.frameMs, {
              maximumFractionDigits: 1,
            }),
            ping: Math.round(hud.ping),
            tick: hud.serverTick,
          })}
        </pre>
      )}
    </main>
  );
}
