"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";

import { useEffect } from "react";

import { Button, ErrorState } from "@/components/ui";

export default function ErrorBoundary({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const t = createTranslator(useLocale());

  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-12 sm:px-6"
    >
      <ErrorState
        className="w-full"
        title={t("pages.interfaceUnavailable")}
        titleAs="h1"
        description={t("pages.thePageCouldNotBeRenderedRetryTheRequest")}
        action={<Button onClick={retry}>{t("pages.retry")}</Button>}
      />
    </main>
  );
}
