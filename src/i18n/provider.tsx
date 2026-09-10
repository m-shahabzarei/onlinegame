"use client";
import { createContext, useContext, useMemo, type ReactNode } from "react";
import { createTranslator } from "./core";
import type { Locale } from "./messages";

const LocaleContext = createContext<Locale>("en");
export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: ReactNode;
}) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}
/** The first client render receives the exact locale selected by the root server layout. */
export function useLocale(): Locale {
  return useContext(LocaleContext);
}
export function useTranslations() {
  const locale = useLocale();
  return useMemo(() => createTranslator(locale), [locale]);
}
