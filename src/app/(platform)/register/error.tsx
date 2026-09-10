"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";

import Link from "next/link";

import { Button, buttonVariants, ErrorState } from "@/components/ui";

export default function RegisterError({
  retry,
}: {
  readonly retry: () => void;
}) {
  const t = createTranslator(useLocale());

  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title={t("pages.registrationIsUnavailable")}
        description={t(
          "pages.weCouldNotLoadAccountRegistrationRetryTheRequest",
        )}
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={retry}>{t("pages.retryRegistration")}</Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/login"
            >
              {t("pages.goToSignIn")}
            </Link>
          </div>
        }
      />
    </section>
  );
}
