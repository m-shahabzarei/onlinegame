"use client";
import { useTranslations } from "@/i18n/provider";

import { useState, useSyncExternalStore } from "react";
import { ArrowLeft, ArrowRight, BookOpen, X } from "lucide-react";
import {
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui";

const STORAGE_KEY = "twoplayer:onboarding:v1";
const subscribeOnboarding = (callback: () => void) => {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
};
function onboardingPending() {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "done";
  } catch {
    return false;
  }
}

export function Onboarding({ forceOpen = false }: { forceOpen?: boolean }) {
  const t = useTranslations();

  const steps = [
    [t("platform.onboardingWelcome"), t("platform.onboardingIntro")],
    [t("platform.buildRoom"), t("platform.buildRoomHelp")],
    [t("platform.readyTogether"), t("platform.readyTogetherHelp")],
    [t("platform.fpsControls"), t("platform.fpsControlsHelp")],
    [t("platform.runEconomy"), t("platform.runEconomyHelp")],
    [t("platform.playSafely"), t("platform.playSafelyHelp")],
  ] as const;

  const persistedOpen = useSyncExternalStore(
    subscribeOnboarding,
    onboardingPending,
    () => false,
  );
  const [dismissed, setDismissed] = useState(false);
  const open = !dismissed && (forceOpen || persistedOpen);
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
    setDismissed(true);
  };
  const [title, copy] = steps[step]!;
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) finish();
      }}
    >
      <DialogContent
        showCloseButton={false}
        aria-labelledby="onboarding-title"
        aria-describedby="onboarding-copy"
        className="border-border bg-surface-elevated shadow-card w-full max-w-lg rounded-xl border p-6 sm:p-8"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <BookOpen aria-hidden="true" className="text-primary size-6" />
            <p className="text-muted-foreground mt-3 font-mono text-xs tracking-[0.16em] uppercase">
              {t("platform.onboardingStep", {
                current: step + 1,
                total: steps.length,
              })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t("platform.skipOnboarding")}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring min-h-11 min-w-11 rounded-md p-2 focus-visible:ring-2"
            onClick={finish}
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        <DialogTitle
          id="onboarding-title"
          className="font-display text-foreground mt-6 text-2xl font-semibold"
        >
          {title}
        </DialogTitle>
        <DialogDescription
          id="onboarding-copy"
          className="text-muted-foreground mt-3 leading-7"
        >
          {copy}
        </DialogDescription>
        <div
          className="mt-6 flex gap-2"
          aria-label={t("platform.onboardingProgress")}
        >
          {steps.map((_, index) => (
            <span
              key={index}
              className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="mt-8 flex items-center justify-between gap-3">
          <Button type="button" variant="ghost" onClick={finish}>
            {t("platform.skip")}
          </Button>
          <div className="flex gap-2">
            {step > 0 ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep((value) => value - 1)}
              >
                <ArrowLeft
                  aria-hidden="true"
                  className="size-4 rtl:rotate-180"
                />{" "}
                {t("platform.back")}
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
              {step === steps.length - 1
                ? t("platform.startExploring")
                : t("platform.next")}
              <ArrowRight
                aria-hidden="true"
                className="size-4 rtl:rotate-180"
              />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
