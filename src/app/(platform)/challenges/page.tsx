import { getRequestLocale, createTranslator, formatNumber } from "@/i18n";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { phase8Service } from "@/server/phase8/service";

export async function generateMetadata() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  return {
    title: t("pages.challenges"),
    description: t("pages.boundedDailyAndWeeklyTwoPlayerChallenges"),
  };
}
export default async function ChallengesPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);

  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/challenges");
  let challenges = [] as Awaited<ReturnType<typeof phase8Service.challenges>>;
  try {
    challenges = await phase8Service.challenges(session.userId);
  } catch {
    /* show safe empty state */
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {t("pages.keepItFocused")}
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          {t("pages.challenges")}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          {t(
            "pages.serverconfirmedProgressEarnsCuratedCosmeticsOnlyChallengesNeverGrant",
          )}
        </p>
      </div>
      {challenges.length === 0 ? (
        <EmptyState
          title={t("pages.challengesAreUnavailable")}
          description={t("pages.tryAgainAfterTheChallengeServiceIsReady")}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((challenge) => (
            <Card key={challenge.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle as="h2" className="text-lg">
                    {t(`challengeUnits.${challenge.unit}`, {
                      count: challenge.target,
                    })}
                  </CardTitle>
                  <span className="text-muted-foreground font-mono text-xs uppercase">
                    {t(`challengeCadence.${challenge.cadence}`)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full"
                    style={{
                      width: `${Math.min(100, Math.round((challenge.progress / challenge.target) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {formatNumber(locale, challenge.progress)} /{" "}
                  {formatNumber(locale, challenge.target)} ·{" "}
                  {challenge.completedAt
                    ? t("pages.completed")
                    : t("pages.inProgress")}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
