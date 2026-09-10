"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { buttonVariants } from "@/components/ui";
import { CatalogErrorState } from "@/components/catalog/catalog-states";

export default function GameDetailsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <CatalogErrorState onRetry={reset} />
        <div className="mt-5 text-center">
          <Link className={buttonVariants({ variant: "ghost" })} href="/games">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to games
          </Link>
        </div>
      </div>
    </div>
  );
}
