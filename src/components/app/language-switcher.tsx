"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateLocaleAction } from "@/server/actions/locale";
import { alternateLocale, createTranslator } from "@/i18n/client";
import type { Locale } from "@/i18n/messages";
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const feedbackId = useId();
  const next = alternateLocale[locale];
  const t = createTranslator(locale);
  return (
    <div className="relative">
      <button
        type="button"
        disabled={pending}
        aria-busy={pending}
        aria-describedby={failed ? feedbackId : undefined}
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring min-h-11 min-w-11 rounded-md px-3 text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none disabled:opacity-60"
        onClick={() =>
          startTransition(async () => {
            setFailed(false);
            try {
              const result = await updateLocaleAction(next);
              if (!result.ok) {
                setFailed(true);
                return;
              }
              router.refresh();
            } catch {
              setFailed(true);
            }
          })
        }
      >
        {pending ? t("localeSwitch.saving") : t(`localeSwitch.${next}`)}
      </button>
      <span
        id={feedbackId}
        role="status"
        aria-live="polite"
        className={
          failed
            ? "bg-surface-elevated text-destructive absolute end-0 top-full z-50 w-64 rounded-md border p-3 text-sm"
            : "sr-only"
        }
      >
        {failed ? t("localeSwitch.failed") : ""}
      </span>
    </div>
  );
}
