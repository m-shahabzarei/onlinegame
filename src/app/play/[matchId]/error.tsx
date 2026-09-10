"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui";
export default function ErrorScreen({ retry }: { retry: () => void }) {
  const t = createTranslator(useLocale());

  return (
    <main id="main-content" className="mx-auto grid max-w-xl gap-5 px-4 py-16">
      <h1 className="font-display text-2xl">
        {t("pages.couldNotLoadYourSession")}
      </h1>
      <p role="alert">
        {t("pages.yourConnectionCouldNotBePreparedRetryOrReturn")}
      </p>
      <Button onClick={retry}>{t("pages.retry")}</Button>
      <Link
        href="/games/nightfall-protocol/rooms"
        className={buttonVariants({ variant: "secondary" })}
      >
        {t("pages.returnToRooms")}
      </Link>
    </main>
  );
}
