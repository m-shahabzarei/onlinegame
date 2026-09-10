import type { Metadata } from "next";

import { AppShell } from "@/components/app/app-shell";
import { HomePage } from "@/components/home/home-page";
import { getCurrentSession } from "@/server/dal/session";
import { getCatalogGames } from "@/server/catalog/catalog-service";

export const metadata: Metadata = {
  title: "Discover cooperative games",
  description:
    "Discover focused cooperative games on TwoPlayer. Multiplayer rooms are coming in Phase 3.",
};

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
