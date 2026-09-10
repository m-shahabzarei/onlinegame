import { CatalogLoadingGrid } from "@/components/catalog/catalog-states";

export default function GamesLoading(): React.JSX.Element {
  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <div className="mb-10 max-w-3xl space-y-4 sm:mb-12">
          <div className="bg-surface-interactive h-3 w-36 animate-pulse rounded-full motion-reduce:animate-none" />
          <div className="bg-surface-interactive h-10 w-3/4 animate-pulse rounded-md motion-reduce:animate-none sm:h-12" />
          <div className="bg-surface-interactive h-5 w-full max-w-2xl animate-pulse rounded-md motion-reduce:animate-none" />
        </div>
        <CatalogLoadingGrid />
      </div>
    </div>
  );
}
