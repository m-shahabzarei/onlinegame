"use client";

import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, X } from "lucide-react";
import { Button } from "@/components/ui";

const STORAGE_KEY = "twoplayer:onboarding:v1";
const steps = [
  [
    "Welcome to TwoPlayer",
    "Choose a game, create a room, and make a focused co-op run with one partner.",
  ],
  [
    "Build a room",
    "Open a game's room browser, create a public or private room, then share the invite link.",
  ],
  [
    "Ready together",
    "Both players choose Ready before the host starts. A reconnect keeps the authoritative match state.",
  ],
  [
    "FPS controls",
    "In a match, use WASD to move, mouse to look, click to fire, R to reload, and E to revive.",
  ],
  [
    "Your run economy",
    "Scrap is spendable in the current match. Score measures results; Contribution measures your share.",
  ],
  [
    "Play safely",
    "Leave through the match controls, reconnect when prompted, and use report or block when a player breaks trust.",
  ],
] as const;

export function Onboarding({ forceOpen = false }: { forceOpen?: boolean }) {
  const [open, setOpen] = useState(() => {
    if (forceOpen || typeof window === "undefined") return forceOpen;
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "done";
    } catch {
      return false;
    }
  });
  const [step, setStep] = useState(0);
  if (!open) return null;
  const finish = () => {
    try {
      window.localStorage.setItem(STORAGE_KEY, "done");
    } catch {
      /* private mode */
    }
    void fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "onboarding",
        version: 1,
        completed: true,
      }),
    }).catch(() => undefined);
    setOpen(false);
  };
  const [title, copy] = steps[step]!;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      role="presentation"
    >
      <section
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-copy"
        aria-modal="true"
        role="dialog"
        className="border-border bg-surface-elevated shadow-card w-full max-w-lg rounded-xl border p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <BookOpen aria-hidden="true" className="text-primary size-6" />
            <p className="text-muted-foreground mt-3 font-mono text-xs tracking-[0.16em] uppercase">
              First session · {step + 1}/{steps.length}
            </p>
          </div>
          <button
            type="button"
            aria-label="Skip onboarding"
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring rounded-md p-2 focus-visible:ring-2"
            onClick={finish}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <h2
          id="onboarding-title"
          className="font-display text-foreground mt-6 text-2xl font-semibold"
        >
          {title}
        </h2>
        <p
          id="onboarding-copy"
          className="text-muted-foreground mt-3 leading-7"
        >
          {copy}
        </p>
        <div className="mt-6 flex gap-2" aria-label="Onboarding progress">
          {steps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={finish}>
            Skip
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((value) => value - 1)}
              >
                <ArrowLeft aria-hidden="true" className="size-4" /> Back
              </Button>
            ) : null}
            <Button
              type="button"
              onClick={() =>
                step === steps.length - 1
                  ? finish()
                  : setStep((value) => value + 1)
              }
            >
              {step === steps.length - 1 ? "Start exploring" : "Next"}
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
