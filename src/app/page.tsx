import { getRequestLocale, createTranslator } from "@/i18n";

import { AppShell } from "@/components/app/app-shell";
import { HomePage } from "@/components/home/home-page";
import { getCurrentSession } from "@/server/dal/session";
import { getCatalogGames } from "@/server/catalog/catalog-service";

export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.discoverCooperativeGames"),
    description: t(
      "pages.discoverFocusedCooperativeGamesOnTwoPlayerMultiplayerRoomsAre",
    ),
  };
}

// Discovery resolves account and catalog state per request; builds must not
// require a reachable runtime database.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [games, session] = await Promise.all([
    getCatalogGames(),
    getCurrentSession(),
  ]);

  return (
    <AppShell user={session?.user ?? null}>
      <HomePage featuredGames={games} user={session?.user ?? null} />
    </AppShell>
  );
}
