"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setGuestLocale } from "@/server/actions/settings";
import type { Locale } from "@/i18n/messages";
export function LanguageSwitcher({ locale }: { locale: Locale }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const next: Locale = locale === "fa" ? "en" : "fa";
  return (
    <button
      type="button"
      disabled={pending}
      className="text-muted-foreground hover:text-foreground min-h-11 px-3 text-sm font-semibold"
      onClick={() =>
        startTransition(async () => {
          await setGuestLocale(next);
          router.refresh();
        })
      }
    >
      {next === "fa" ? "فارسی" : "English"}
    </button>
  );
}
