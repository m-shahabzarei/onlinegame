"use client";
import { useTranslations } from "@/i18n/provider";

/** Keeps buttonVariants callable by server components while sharing root locale. */
export function LocalizedLoading() {
  const t = useTranslations();
  return t("platform.loading");
}
