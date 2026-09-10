import { catalogCopy } from "@/i18n/catalog";
import {
  getRequestLocale,
  createTranslator,
  formatNumber,
  formatDate,
} from "@/i18n";
import { redirect } from "next/navigation";
import Link from "next/link";
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
    title: t("pages.matchHistory"),
    description: t("pages.reviewYourCompletedTwoPlayerRuns"),
  };
}

export default async function HistoryPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);

  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/history");
  let history;
  try {
    history = await phase8Service.history(session.userId);
  } catch {
    history = { items: [], nextCursor: null };
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {t("pages.yourRuns")}
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          {t("pages.matchHistory")}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          {t(
            "pages.onlyYourAuthorizedMatchSummariesAppearHereHighfrequencyGameplay",
          )}
        </p>
      </div>
      {history.items.length === 0 ? (
        <EmptyState
          title={t("pages.noCompletedRunsYet")}
          description={t("pages.finishACooperativeRunAndItsSummaryWillAppear")}
          action={
            <Link
              className="text-primary font-semibold underline-offset-4 hover:underline"
              href="/games"
            >
              {t("pages.chooseAGame")}
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {history.items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle as="h2">
                    {catalogCopy(locale, item.game.slug).name}
                  </CardTitle>
                  <span
                    className={
                      item.result === "VICTORY" ||
                      item.result === "PHASE_COMPLETE"
                        ? "text-success font-semibold"
                        : "text-warning font-semibold"
                    }
                  >
                    {item.result === "VICTORY"
                      ? t("pages.victory")
                      : item.result === "PHASE_COMPLETE"
                        ? t("pages.complete")
                        : t("pages.defeat")}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {formatDate(locale, item.createdAt, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground block">
                    {t("pages.waves")}
                  </span>
                  <strong>{formatNumber(locale, item.completedWaves)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    {t("pages.score")}
                  </span>
                  <strong>{formatNumber(locale, item.score)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    {t("pages.contribution")}
                  </span>
                  <strong>{formatNumber(locale, item.contribution)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    {t("pages.revives")}
                  </span>
                  <strong>{formatNumber(locale, item.revives)}</strong>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
