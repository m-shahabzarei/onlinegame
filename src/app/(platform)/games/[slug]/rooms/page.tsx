import { notFound } from "next/navigation";
import { getCatalogGame } from "@/server/catalog";
import { getCurrentSession } from "@/server/dal/session";
import { RoomBrowser } from "@/components/lobby/room-browser";
import { SessionRequired } from "@/components/lobby/shared";
import { localizeCatalogGame } from "@/i18n/catalog";
import { getRequestLocale, createTranslator } from "@/i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return { title: t("pages.roomBrowser") };
}
export default async function GameRoomsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const game = await getCatalogGame(slug);
  if (!game || slug !== "nightfall-protocol") notFound();
  const session = await getCurrentSession();
  if (!session)
    return (
      <div className="px-4 py-12">
        <SessionRequired next={`/games/${slug}/rooms`} />
      </div>
    );
  return (
    <RoomBrowser
      slug={slug}
      name={localizeCatalogGame(await getRequestLocale(), game).name}
      locale={await getRequestLocale()}
    />
  );
}
