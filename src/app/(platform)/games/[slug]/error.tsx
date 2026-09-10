"use client";
import { createTranslator } from "@/i18n/client";
import { useLocale } from "@/i18n/provider";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui";
import { CatalogErrorState } from "@/components/catalog/catalog-states";

export default function GameDetailsError({
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}): React.JSX.Element {
  const t = createTranslator(useLocale());

  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <CatalogErrorState onRetry={retry} />
        <div className="mt-5 text-center">
          <Link className={buttonVariants({ variant: "ghost" })} href="/games">
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("pages.backToGames")}
          </Link>
        </div>
      </div>
    </div>
  );
}
