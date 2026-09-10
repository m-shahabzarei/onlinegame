import { getRequestLocale, createTranslator } from "@/i18n";
import { getCurrentSession } from "@/server/dal/session";
import { normalizeRoomCode } from "@/domain/lobby";
import { RoomLobby } from "@/components/lobby/room-lobby";
import { SessionRequired } from "@/components/lobby/shared";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.sessionPrepared"),
    referrer: "no-referrer" as const,
    robots: { index: false, follow: false },
  };
}
export default async function PreparationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const code = normalizeRoomCode((await params).code).slice(0, 32);
  if (!(await getCurrentSession()))
    return (
      <div className="px-4 py-12">
        <SessionRequired next={`/rooms/${encodeURIComponent(code)}/prepare`} />
      </div>
    );
  return <RoomLobby code={code} prepare />;
}
