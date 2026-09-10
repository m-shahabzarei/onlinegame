"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import type { GameRuntime, HudState } from "@/game/client/runtime";
import { INITIAL_PVE_HUD } from "@/game/client/pve-hud";
import { terminalState } from "@/game/shared/lifecycle";
import styles from "./game.module.css";
import { Phase6Shop } from "./phase6-shop";
import type { Locale } from "@/i18n/messages";

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
  teammate: "Waiting for teammate",
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
  const canvas = useRef<HTMLCanvasElement>(null),
    engine = useRef<GameRuntime | null>(null),
    enter = useRef<HTMLButtonElement>(null);
  const [hud, setHud] = useState(initial),
    [status, setStatus] = useState<
      "loading" | "ready" | "unsupported" | "failed"
    >("loading"),
    [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS),
    [settingsOpen, setSettingsOpen] = useState(false),
    [leaveOpen, setLeaveOpen] = useState(false),
    [diagnostics, setDiagnostics] = useState(false),
    [failure, setFailure] = useState("");
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
          preferences,
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
          (u) => !cancelled && setHud(u),
          matchId,
        );
        if (cancelled) {
          instance.dispose();
          return;
        }
        engine.current = instance;
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setFailure(
            "WebGL 2 could not start. Enable hardware acceleration in a supported desktop browser, then reload.",
          );
          setStatus("failed");
        }
      }
    })();
    return () => {
      cancelled = true;
      instance?.dispose();
      engine.current = null;
    };
  }, [matchId, preferences]);
  const terminal = terminalState(hud.state);
  const title =
    status === "unsupported"
      ? "Desktop graphics required"
      : status === "failed"
        ? "Connection failed"
        : terminal
          ? hud.phase6Outcome === "VICTORY"
            ? "Victory · Abomination defeated"
            : hud.wave.state === "TEAM_DEFEATED"
              ? "Team defeated"
              : hud.wave.state === "PHASE_COMPLETE"
                ? hud.phase6Profile === "phase6-production"
                  ? "Survival profile complete"
                  : "Five-wave survival complete"
                : "Cooperative session ended"
          : hud.state === "WAITING_FOR_PLAYERS"
            ? hud.mode === "solo"
              ? "Preparing solo arena"
              : "Waiting for your teammate"
            : hud.state === "LOADING"
              ? hud.mode === "solo"
                ? "Preparing your arena"
                : "Teammate is loading"
              : hud.state === "COUNTDOWN"
                ? `Survival begins in ${hud.countdown}`
                : "Click to enter game";
  const description =
    status === "unsupported"
      ? "Use a supported desktop browser with pointer lock and WebGL 2."
      : status === "failed"
        ? failure
        : terminal
          ? "The run has ended. Returning to rooms is available."
          : hud.mode === "solo"
            ? "Your server-authoritative solo arena is ready."
            : "The server preserves the shared arena during reconnect.";
  const leave = async () => {
    try {
      await engine.current?.leave();
    } finally {
      router.push("/games/nightfall-protocol/rooms");
    }
  };
  return (
    <main
      id="main-content"
      className={styles.game}
      aria-label="Nightfall Protocol survival arena"
    >
      <canvas
        ref={canvas}
        className={styles.canvas}
        aria-label="First-person industrial survival arena"
      />
      <div className={styles.top}>
        <div className={styles.panel}>
          <span className={styles.eyebrow}>NIGHTFALL PROTOCOL</span>
          <strong>
            QUARANTINE YARD <span className={styles.tag}>SURVIVAL</span>
          </strong>
          <span className={styles.wave}>
            Wave {hud.wave.number || 1} /{" "}
            {hud.phase6Profile === "phase6-production" ? 10 : 5} ·{" "}
            {hud.wave.state.replaceAll("_", " ")}
          </span>
        </div>
        <div className={`${styles.panel} ${styles.connection}`}>
          <Signal size={17} aria-hidden="true" />
          <span>{hud.connection}</span>
          <span className={styles.mono}>{Math.round(hud.ping)} ms</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              engine.current?.pause();
              setSettingsOpen(true);
            }}
            aria-label="Open game settings"
          >
            <Settings2 aria-hidden="true" size={18} />
          </Button>
        </div>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {hud.connection}. {title}
      </p>
      {status === "ready" && !terminal && (
        <div className={styles.combatStatus}>
          {hud.life === "DOWNED" && (
            <div className={styles.lifeNotice} role="status">
              <strong>
                {hud.mode === "solo"
                  ? "DOWNED · bleed-out in progress"
                  : "DOWNED · waiting for your teammate"}
              </strong>
              <span className={styles.mono}>
                Bleed-out in {hud.bleedOutSeconds}s
              </span>
              <span>
                {hud.mode === "solo"
                  ? "Movement and weapons disabled. No teammate revive is available in solo mode."
                  : "Movement and weapons disabled. A living teammate can hold E nearby to revive you."}
              </span>
            </div>
          )}
          {hud.recoveryPending && (
            <p className={styles.lifeNotice}>
              {hud.mode === "solo"
                ? "Recovery pending · reconnect before grace expires"
                : "Recovery pending · waiting for teammate reconnect"}
            </p>
          )}
        </div>
      )}
      <div className={styles.bottom}>
        <div className={styles.panel}>
          <span className={styles.eyebrow}>
            <Heart size={14} aria-hidden="true" /> VITALS
          </span>
          <div className={styles.health}>
            <strong className={styles.mono}>{hud.health}</strong>
            <span>{hud.life}</span>
          </div>
          <progress
            className={styles.healthBar}
            aria-label="Your health"
            value={hud.health}
            max={hud.maxHealth}
          />
        </div>
        <div className={`${styles.panel} ${styles.teammate}`}>
          <span className={styles.eyebrow}>
            <UsersRound size={14} aria-hidden="true" />{" "}
            {hud.mode === "solo" ? "MODE" : "TEAMMATE"}
          </span>
          <strong>{hud.mode === "solo" ? "SOLO" : hud.teammate}</strong>
          <span>
            {hud.mode === "solo"
              ? "One player · server authoritative"
              : hud.teammateConnected
                ? `${hud.teammateHealth} HP · ${hud.teammateLife}`
                : "Waiting / reconnecting"}
          </span>
        </div>
        <div className={`${styles.panel} ${styles.ammo}`}>
          <span className={styles.eyebrow}>AR-01 / SERVICE RIFLE</span>
          <div>
            <strong className={styles.mono}>
              {String(hud.magazine).padStart(2, "0")}
            </strong>
            <span className={styles.mono}> / {hud.reserve}</span>
          </div>
          <span>
            {hud.reloading
              ? "Reloading…"
              : hud.magazine === 0
                ? "Empty magazine · R to reload"
                : "AUTO · R to reload"}
          </span>
        </div>
      </div>
      {status !== "ready" || !hud.locked || terminal ? (
        <section className={styles.scrim} aria-labelledby="arena-status">
          <div className={styles.card}>
            <div className={styles.cardIcon}>
              <Crosshair aria-hidden="true" />
            </div>
            <span className={styles.eyebrow}>TWO PLAYER / ONE SESSION</span>
            <h1 id="arena-status">{title}</h1>
            <p>{description}</p>
            {status === "ready" && !terminal && (
              <Button ref={enter} onClick={() => engine.current?.enter()}>
                Enter arena
              </Button>
            )}
            {status === "failed" && (
              <Button onClick={() => window.location.reload()}>
                Reload game
              </Button>
            )}
            <div className={styles.actions}>
              <Link
                className={buttonVariants({ variant: "secondary" })}
                href="/games/nightfall-protocol/rooms"
              >
                Return to rooms
              </Link>
              {status === "ready" && !terminal && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    engine.current?.pause();
                    setLeaveOpen(true);
                  }}
                >
                  Leave match
                </Button>
              )}
              {status === "ready" && !terminal && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    engine.current?.pause();
                    setSettingsOpen(true);
                  }}
                >
                  Settings
                </Button>
              )}
            </div>
          </div>
        </section>
      ) : null}
      <Phase6Shop
        open={hud.shopOpen && hud.locked && !terminal}
        scrap={hud.scrap}
        ownedWeapons={hud.ownedWeapons}
        equippedWeapon={hud.equippedWeapon}
        onPurchase={(kind, id) => engine.current?.purchasePhase6(kind, id)}
        onClose={() => engine.current?.pause()}
        locale={locale}
      />
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogTitle>Game settings</DialogTitle>
          <DialogDescription>
            Changes apply immediately while the online match continues.
          </DialogDescription>
          <label className={styles.check}>
            <span>Reduce camera motion and weapon bob</span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(e) => {
                const next = { ...settings, reducedMotion: e.target.checked };
                setSettings(next);
                engine.current?.configure(next);
              }}
            />
          </label>
          <label className={styles.check}>
            <span>Network and performance diagnostics</span>
            <input
              type="checkbox"
              checked={diagnostics}
              onChange={(e) => setDiagnostics(e.target.checked)}
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              setSettings(DEFAULT_SETTINGS);
              engine.current?.configure(DEFAULT_SETTINGS);
            }}
          >
            Restore defaults
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <DialogContent>
          <DialogTitle>Leave this match?</DialogTitle>
          <DialogDescription>
            This ends the session and returns you to rooms.
          </DialogDescription>
          <Button variant="secondary" onClick={() => setLeaveOpen(false)}>
            Stay in match
          </Button>
          <Button variant="destructive" onClick={() => void leave()}>
            Leave match
          </Button>
        </DialogContent>
      </Dialog>
      {process.env.NODE_ENV !== "production" && diagnostics && (
        <pre className={styles.diagnostics} aria-label="Game diagnostics">
          {hud.fps} FPS / {hud.frameMs.toFixed(1)} ms\nPing{" "}
          {hud.ping.toFixed(0)} ms · tick {hud.serverTick}
        </pre>
      )}
    </main>
  );
}
