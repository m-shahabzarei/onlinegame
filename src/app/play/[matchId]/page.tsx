import Link from "next/link";
import { getStrictCurrentSession } from "@/server/dal/session";
import { getGameplayService } from "@/server/gameplay";
import { GameShell } from "@/components/game/game-shell";
import { SessionRequired } from "@/components/lobby/shared";
import { buttonVariants } from "@/components/ui";
import { getRequestLocale, createTranslator } from "@/i18n";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.trainingArena"),
    referrer: "no-referrer" as const,
    robots: { index: false, follow: false },
  };
}
export default async function PlayPage({
  params,
}: {
  params: Promise<{ matchId: string }>;
}) {
  const t = createTranslator(await getRequestLocale());

  const { matchId } = await params;
  const session = await getStrictCurrentSession();
  if (!session)
    return (
      <main id="main-content" className="mx-auto max-w-xl px-4 py-16">
        <SessionRequired next={`/play/${encodeURIComponent(matchId)}`} />
      </main>
    );
  try {
    await getGameplayService().authorize(session.userId, matchId);
  } catch {
    return (
      <main
        id="main-content"
        className="mx-auto grid max-w-xl gap-5 px-4 py-16"
      >
        <h1 className="font-display text-2xl">
          {t("pages.trainingSessionUnavailable")}
        </h1>
        <p className="text-muted-foreground">
          {t("pages.thisReservationHasEndedIsUnavailableToYourSession")}
        </p>
        <Link
          href="/games/nightfall-protocol/rooms"
          className={buttonVariants({ variant: "secondary" })}
        >
          {t("pages.returnToRooms")}
        </Link>
      </main>
    );
  }
  return (
    <GameShell
      matchId={matchId}
      locale={await getRequestLocale()}
      preferences={{
        reducedMotion: session.user.reducedMotion,
        soundEnabled: session.user.soundEnabled,
      }}
    />
  );
}
