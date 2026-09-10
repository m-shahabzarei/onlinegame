"use client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { createTranslator } from "@/i18n/client";

import { Compass, RefreshCcw } from "lucide-react";
import Link from "next/link";

import {
  buttonVariants,
  EmptyState,
  ErrorState,
  Skeleton,
} from "@/components/ui";
import { cn } from "@/lib/cn";

export function CatalogLoadingGrid({ count = 6 }: { count?: number }) {
  const t = useTranslations();

  return (
    <div
      aria-label={t("platform.loadingCatalog")}
      className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3"
      role="status"
    >
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="border-border bg-surface/80 shadow-card overflow-hidden rounded-lg border p-4 sm:p-5"
        >
          <Skeleton className="aspect-[16/9] w-full" />
          <div className="mt-5 space-y-3">
            <Skeleton className="h-5 w-3/5" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-4/5" />
            <div className="flex gap-3 pt-2">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-4 w-1/4" />
            </div>
          </div>
        </div>
      ))}
      <span className="sr-only">{t("platform.loadingCatalogEllipsis")}</span>
    </div>
  );
}

export function CatalogEmptyState({ className }: { className?: string }) {
  const locale = useLocale();
  const t = createTranslator(locale);

  return (
    <EmptyState
      className={cn(className)}
      title={t("platform.catalogEmpty")}
      description={t("platform.catalogEmptyHelp")}
      icon={<Compass aria-hidden="true" />}
      action={
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/games"
          >
            <RefreshCcw aria-hidden="true" className="size-4" />
            {t("platform.retryCatalog")}
          </Link>
          <Link className={buttonVariants({ variant: "ghost" })} href="/">
            {t("platform.backDiscover")}
          </Link>
        </div>
      }
    />
  );
}

export function CatalogErrorState({ onRetry }: { onRetry?: () => void }) {
  const locale = useLocale();
  const t = createTranslator(locale);

  return (
    <ErrorState
      titleAs="h1"
      title={t("platform.catalogError")}
      description={t("platform.catalogErrorHelp")}
      action={
        <div className="flex flex-wrap justify-center gap-3">
          {onRetry ? (
            <button
              className={buttonVariants({ variant: "primary" })}
              type="button"
              onClick={onRetry}
            >
              <RefreshCcw aria-hidden="true" className="size-4" />
              {t("platform.tryAgain")}
            </button>
          ) : null}
          <Link className={buttonVariants({ variant: "outline" })} href="/">
            {t("platform.backDiscover")}
          </Link>
        </div>
      }
    />
  );
}
