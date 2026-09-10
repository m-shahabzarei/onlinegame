import { getRequestLocale, createTranslator } from "@/i18n";
import { redirect } from "next/navigation";

import { LogoutButton, SettingsForm } from "@/components/forms";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { logoutAction } from "@/server/actions/auth";
import { updateSettingsAction } from "@/server/actions/settings";
import { getStrictCurrentSession } from "@/server/dal/session";
import { ReplayOnboarding } from "@/components/onboarding/replay-onboarding";

export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.settings"),
    description: t("pages.manageYourTwoPlayerAccountAndExperiencePreferences"),
  };
}

export default async function SettingsPage() {
  const t = createTranslator(await getRequestLocale());

  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/settings");

  const user = session.user;

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="space-y-3">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {t("pages.controlRoom")}
        </p>
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          {t("pages.settings")}
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-7">
          {t("pages.tuneYourAccountPreferencesSoundIsRepresentedHereAs")}
        </p>
      </div>
      <SettingsForm
        action={updateSettingsAction}
        values={{
          locale: user.locale,
          reducedMotion: user.reducedMotion,
          soundEnabled: user.soundEnabled,
        }}
      />
      <Card variant="subtle">
        <CardHeader>
          <CardTitle as="h2">{t("pages.gettingStarted")}</CardTitle>
          <CardDescription>
            {t("pages.reviewRoomMatchAndControlGuidanceWheneverYouNeed")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReplayOnboarding />
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("pages.accountSession")}</CardTitle>
            <CardDescription>
              {t("pages.endThisBrowserSessionSafely")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton action={logoutAction} />
          </CardContent>
        </Card>
        <Card variant="subtle" className="border-border-strong/70">
          <CardHeader>
            <CardTitle as="h2">{t("pages.deleteAccount")}</CardTitle>
            <CardDescription>
              {t("pages.accountDeletionWillBeAvailableOnlyWithAVerified")}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <Badge variant="neutral">{t("pages.notAvailableYet")}</Badge>
            <Button
              type="button"
              variant="outline"
              disabled
              aria-disabled="true"
            >
              {t("pages.requestDeletion")}
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
