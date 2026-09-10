import { getRequestLocale, createTranslator, formatDate } from "@/i18n";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ProfileForm, LogoutButton } from "@/components/forms";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { logoutAction } from "@/server/actions/auth";
import { updateProfileAction } from "@/server/actions/profile";
import { phase8Service } from "@/server/phase8/service";

export async function generateMetadata() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  return {
    title: t("pages.profile"),
    description: t("pages.manageYourTwoPlayerPlayerIdentity"),
  };
}

export default async function ProfilePage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);

  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/profile");

  const user = session.user;
  const createdAt = user.createdAt.toISOString();
  let summary: Awaited<ReturnType<typeof phase8Service.profileSummary>> | null =
    null;
  try {
    summary = await phase8Service.profileSummary(user.id);
  } catch {
    summary = null;
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)] lg:px-8">
      <div className="grid gap-6">
        <div className="space-y-3">
          <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
            {t("pages.accountIdentity")}
          </p>
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("pages.yourProfile")}
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-7">
            {t("pages.chooseHowYouAppearAcrossTwoPlayerThenReviewRecent")}
          </p>
        </div>
        {user.isGuest ? (
          <Card variant="subtle" className="border-warning/35">
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div>
                <Badge variant="warning">
                  {t("pages.temporaryGuestProfile")}
                </Badge>
                <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
                  {t(
                    "pages.thisIdentityIsTemporaryRegistrationCreatesASeparatePermanent",
                  )}
                </p>
              </div>
              <Link
                className="text-primary focus-visible:ring-ring min-h-11 rounded-md px-2 py-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                href="/register"
              >
                {t("pages.createAnAccount")}
              </Link>
            </CardContent>
          </Card>
        ) : null}
        <ProfileForm
          action={updateProfileAction}
          user={{
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
          }}
        />
      </div>

      <aside className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">{t("pages.accountStatus")}</CardTitle>
            <CardDescription>
              {t(
                "pages.persistentIdentityDetailsOnlyNoGameplayStatsAreFabricated",
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="border-border flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">{t("pages.status")}</span>
              <Badge variant={user.isGuest ? "warning" : "success"}>
                {user.isGuest ? t("pages.guest") : t("pages.active")}
              </Badge>
            </div>
            <div className="border-border flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">{t("pages.joined")}</span>
              <time className="text-foreground text-end" dateTime={createdAt}>
                {formatDate(locale, user.createdAt, { dateStyle: "medium" })}
              </time>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">
                {t("pages.matchHistory")}
              </span>
              {summary ? (
                <span className="text-foreground">
                  {t("pages.matchSummary", {
                    completed: summary.matchesCompleted,
                    wins: summary.wins,
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t("pages.notEnoughDataYet")}
                </span>
              )}
            </div>
            <Link
              className="text-primary font-semibold underline-offset-4 hover:underline"
              href={"/history" as never}
            >
              {t("pages.viewMatchHistory")}
            </Link>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle as="h2">{t("pages.session")}</CardTitle>
            <CardDescription>
              {t("pages.signOutSafelyOnSharedDevices")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton action={logoutAction} />
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}
