import { notFound } from "next/navigation";
import { getCatalogGame } from "@/server/catalog";
import { getCurrentSession } from "@/server/dal/session";
import { RoomBrowser } from "@/components/lobby/room-browser";
import { SessionRequired } from "@/components/lobby/shared";
import { getRequestLocale } from "@/i18n";
export const dynamic = "force-dynamic";
export const metadata = { title: "Room browser" };
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
      name={game.name}
      locale={await getRequestLocale()}
    />
  );
}
