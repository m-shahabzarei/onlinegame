import { getRequestLocale, createTranslator } from "@/i18n";
import { CatalogLoadingGrid } from "@/components/catalog/catalog-states";

export default async function GameDetailsLoading(): Promise<React.JSX.Element> {
  const t = createTranslator(await getRequestLocale());

  return (
    <div className="min-h-dvh px-4 py-10 sm:px-6 lg:py-14">
      <p className="sr-only" role="status" aria-live="polite">
        {t("pages.loadingGameDetails")}
      </p>
      <div className="mx-auto w-full max-w-7xl">
        <div className="bg-surface-interactive mb-8 h-11 w-36 animate-pulse rounded-md motion-reduce:animate-none" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:gap-12">
          <div className="space-y-6">
            <div className="border-border bg-surface-interactive aspect-[16/9] animate-pulse rounded-xl border motion-reduce:animate-none" />
            <div className="bg-surface-interactive h-6 w-5/6 animate-pulse rounded-md motion-reduce:animate-none" />
          </div>
          <div className="space-y-5">
            <div className="bg-surface-interactive h-6 w-2/5 animate-pulse rounded-full motion-reduce:animate-none" />
            <div className="bg-surface-interactive h-10 w-4/5 animate-pulse rounded-md motion-reduce:animate-none" />
            <div className="border-border bg-surface-interactive h-28 animate-pulse rounded-lg border motion-reduce:animate-none" />
            <div className="border-border bg-surface-interactive h-36 animate-pulse rounded-lg border motion-reduce:animate-none" />
          </div>
        </div>
        <div className="mt-12 hidden lg:block">
          <CatalogLoadingGrid count={2} />
        </div>
      </div>
    </div>
  );
}
