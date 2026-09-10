"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";

import { Button, ErrorState } from "@/components/ui";

export default function ProfileError({
  retry,
}: {
  readonly retry: () => void;
}) {
  const t = createTranslator(useLocale());

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title={t("pages.profileCouldNotLoad")}
        description={t("pages.weCouldNotRetrieveYourProfileRetryTheRequest")}
        action={<Button onClick={retry}>{t("pages.retry")}</Button>}
      />
    </section>
  );
}
