"use client";
import { createTranslator } from "@/i18n/client";
import { isLocale, LOCALE_COOKIE, localeDirection } from "@/i18n/core";
import { persianFont } from "@/i18n/font";
import { useSyncExternalStore } from "react";

import type { CSSProperties } from "react";
import { useEffect } from "react";

import "./globals.css";

import { Button, ErrorState } from "@/components/ui";

const fallbackFontVariables = {
  "--font-geist": '"Segoe UI"',
  "--font-orbitron": '"Arial Narrow"',
  "--font-geist-mono": '"Cascadia Code"',
} as CSSProperties;

// Global errors replace the provider and root layout. Wait for the durable cookie
// before rendering prose so Persian visitors never see an English recovery flash.
const subscribe = () => () => {};
function getEmergencyLocale() {
  const value = document.cookie
    .split("; ")
    .find((part) => part.startsWith(LOCALE_COOKIE + "="))
    ?.split("=")[1];
  return isLocale(value) ? value : "en";
}
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  const locale = useSyncExternalStore(
    subscribe,
    getEmergencyLocale,
    () => null,
  );
  const t = createTranslator(locale ?? "en");

  useEffect(() => {
    console.error("Application root error", error);
  }, [error]);

  return (
    <html
      lang={locale ?? undefined}
      dir={locale ? localeDirection[locale] : undefined}
      data-locale={locale ?? undefined}
      className="dark"
    >
      <head>
        <title>{locale ? t("pages.twoPlayerError") : "TwoPlayer"}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={fallbackFontVariables} className={persianFont.variable}>
        <main
          id="main-content"
          className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-12 sm:px-6"
        >
          {locale ? (
            <ErrorState
              className="w-full"
              title={t("pages.twoPlayerCouldNotStart")}
              titleAs="h1"
              description={t(
                "pages.aRootlevelErrorInterruptedTheInterfaceRetryOnceThen",
              )}
              action={
                <Button onClick={retry}>{t("pages.restartInterface")}</Button>
              }
            />
          ) : (
            <div aria-busy="true" />
          )}
        </main>
      </body>
    </html>
  );
}
