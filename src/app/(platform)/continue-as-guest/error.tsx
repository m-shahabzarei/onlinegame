"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";

import Link from "next/link";

import { Button, buttonVariants, ErrorState } from "@/components/ui";

export default function GuestAccessError({
  retry,
}: {
  readonly retry: () => void;
}) {
  const t = createTranslator(useLocale());

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title={t("pages.guestAccessIsUnavailable")}
        description={t("pages.weCouldNotPrepareATemporaryGuestSessionRetry")}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={retry}>{t("pages.retryGuestAccess")}</Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/games"
            >
              {t("pages.browseGames")}
            </Link>
          </div>
        }
      />
    </section>
  );
}
