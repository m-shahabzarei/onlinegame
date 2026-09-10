"use client";

import { CatalogErrorState } from "@/components/catalog/catalog-states";

export default function GamesError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): React.JSX.Element {
  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <CatalogErrorState onRetry={reset} />
      </div>
    </div>
  );
}
