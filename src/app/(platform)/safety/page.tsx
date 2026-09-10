import { getRequestLocale, createTranslator } from "@/i18n";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { SafetyForm } from "@/components/safety/safety-form";

export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.trustAndSafety"),
    description: t("pages.reportBlockAndManagePlayerSafetyConcerns"),
  };
}
export default async function SafetyPage() {
  const t = createTranslator(await getRequestLocale());

  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/safety");
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {t("pages.playWithCare")}
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          {t("pages.trustAndSafety")}
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">
          {t(
            "pages.reportsArePrivateRatelimitedAndReviewedSeparatelyFromGameplay",
          )}
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle as="h2">{t("pages.reportAPlayer")}</CardTitle>
          <CardDescription>
            {t("pages.useThePlayerIdentifierShownInAnAuthorizedMatch")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SafetyForm />
        </CardContent>
      </Card>
      <Card variant="subtle">
        <CardHeader>
          <CardTitle as="h2">{t("pages.communityGuidelines")}</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-6">
          <p>
            {t("pages.coordinateRespectfullyDoNotExploitBugsHarassTeammatesOr")}
          </p>
          <p>{t("pages.textAndVoiceChatAreNotAvailableInTwoPlayer")}</p>
        </CardContent>
      </Card>
    </section>
  );
}
