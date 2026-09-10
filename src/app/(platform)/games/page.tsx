import { getRequestLocale, createTranslator } from "@/i18n";

import { CatalogEmptyState } from "@/components/catalog/catalog-states";
import { CatalogGrid as GameCatalogGrid } from "@/components/catalog/catalog-grid";
import { getCatalogGames } from "@/server/catalog";

// Runtime rendering avoids a database dependency during the Vercel build;
// the server catalog boundary still caches persisted reads for five minutes.
export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.games"),
    description: t("pages.browseCooperativeGameBriefsAndDiscoverWhatIsComing"),
  };
}

export default async function GamesPage(): Promise<React.JSX.Element> {
  const t = createTranslator(await getRequestLocale());

  const games = await getCatalogGames();

  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-7xl">
        <header className="mb-10 max-w-3xl sm:mb-12">
          <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
            {t("pages.twoPlayerCatalog")}
          </p>
          <h1 className="font-display text-foreground mt-3 text-3xl font-semibold tracking-[0.03em] sm:text-4xl lg:text-5xl">
            {t("pages.chooseYourNextSignal")}
          </h1>
          <p className="text-muted-foreground mt-4 max-w-2xl text-base leading-7 sm:text-lg">
            {t("pages.exploreTheCooperativeWorldsTakingShapeOnTwoPlayerRead")}
          </p>
        </header>

        {games.length > 0 ? (
          <section aria-labelledby="catalog-heading">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2
                  id="catalog-heading"
                  className="font-display text-foreground text-xl font-semibold tracking-[0.03em]"
                >
                  {t("pages.gameBriefs")}
                </h2>
                <p className="text-muted-foreground mt-1 text-sm">
                  {t("pages.catalogCount", { count: games.length })}
                </p>
              </div>
              <p className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
                {t("pages.multiplayerSessionsArriveInPhase3")}
              </p>
            </div>
            <GameCatalogGrid games={games} />
          </section>
        ) : (
          <CatalogEmptyState />
        )}
      </div>
    </div>
  );
}
