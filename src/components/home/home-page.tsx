"use client";
import { useTranslations } from "@/i18n/provider";

import {
  ArrowRight,
  Check,
  Compass,
  Gamepad2,
  Link2,
  LockKeyhole,
  Mic2,
  ShieldCheck,
  Swords,
  UsersRound,
} from "lucide-react";
import Link from "next/link";

import type { SafeUser } from "@/domain/auth";
import type { CatalogGame } from "@/domain/catalog";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { cn } from "@/lib/cn";
import { GameCard } from "@/components/catalog/game-card";

export interface HomePageProps {
  featuredGames: readonly CatalogGame[];
  user: SafeUser | null;
}

export function HomePage({ featuredGames, user }: HomePageProps) {
  const t = useTranslations();

  const comingSoon = [
    {
      icon: LockKeyhole,
      title: t("platform.privateRooms"),
      description: t("platform.privateRoomsHelp"),
    },
    {
      icon: Link2,
      title: t("platform.inviteLinks"),
      description: t("platform.inviteLinksHelp"),
    },
    {
      icon: UsersRound,
      title: t("platform.matchmaking"),
      description: t("platform.matchmakingHelp"),
    },
    {
      icon: Mic2,
      title: t("platform.voiceChat"),
      description: t("platform.voiceChatHelp"),
    },
    {
      icon: ShieldCheck,
      title: t("platform.matchHistory"),
      description: t("platform.matchHistoryHelp"),
    },
  ] as const;

  return (
    <div className="mx-auto w-full max-w-screen-2xl px-4 pb-8 sm:px-6 lg:px-8 2xl:px-12">
      <section className="relative isolate overflow-hidden py-12 sm:py-16 lg:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="bg-primary/15 absolute -start-24 top-0 size-80 rounded-full blur-3xl" />
          <div className="bg-accent/10 absolute end-0 top-24 size-96 rounded-full blur-3xl" />
          <div className="via-primary/40 absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-transparent to-transparent" />
          <div className="absolute inset-y-0 end-[-12%] hidden w-1/2 opacity-60 lg:block">
            <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent_0%,color-mix(in_srgb,var(--primary)_12%,transparent)_48%,transparent_49%),linear-gradient(90deg,transparent_49%,color-mix(in_srgb,var(--border)_55%,transparent)_50%,transparent_51%)] bg-size-[100%_100%,56px_56px]" />
            <div className="border-primary/25 absolute end-14 top-12 size-72 rounded-full border shadow-[0_0_90px_-35px_var(--primary)]" />
            <div className="border-accent/20 absolute end-28 top-26 size-44 rounded-full border" />
          </div>
        </div>

        <div className="relative max-w-3xl">
          <Badge
            variant="accent"
            className="font-mono tracking-[0.12em] uppercase"
          >
            <Swords aria-hidden="true" className="size-3.5" />
            {t("platform.liveSessions")}
          </Badge>
          <h1 className="font-display text-foreground mt-6 max-w-3xl text-4xl leading-[1.08] font-bold tracking-[0.015em] sm:text-5xl lg:text-7xl">
            {t("platform.homeTitle")}
            <span className="text-primary">
              {t("platform.homeTitleAccent")}
            </span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
            {t("platform.homeIntro")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/games" className={buttonVariants({ size: "lg" })}>
              {t("platform.exploreGames")}
              <ArrowRight
                aria-hidden="true"
                className="size-5 rtl:rotate-180"
              />
            </Link>
            <Link
              href={user ? "/profile" : "/continue-as-guest"}
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "text-muted-foreground",
              )}
            >
              {user ? t("platform.reviewProfile") : t("platform.browseGuest")}
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <span className="text-muted-foreground inline-flex items-center gap-2">
              <Check aria-hidden="true" className="text-success size-4" />
              {t("platform.noAccount")}
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-2">
              <Check aria-hidden="true" className="text-success size-4" />
              {t("platform.twoPlayerFocus")}
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="featured-games" className="py-12 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-primary font-mono text-xs font-semibold tracking-[0.16em] uppercase">
              {t("platform.discoverStep")}
            </p>
            <h2
              id="featured-games"
              className="font-display text-foreground mt-2 text-2xl font-semibold tracking-[0.03em] sm:text-3xl"
            >
              {t("platform.discoverTitle")}
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
              {t("platform.discoverHelp")}
            </p>
          </div>
          <Link
            href="/games"
            className="text-primary hover:text-primary-hover focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            {t("platform.fullCatalog")}{" "}
            <ArrowRight aria-hidden="true" className="size-4 rtl:rotate-180" />
          </Link>
        </div>
        {featuredGames.length > 0 ? (
          <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {featuredGames.slice(0, 3).map((game) => (
              <GameCard key={game.slug} game={game} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-8"
            icon={<Compass aria-hidden="true" />}
            title={t("platform.catalogWarming")}
            description={t("platform.catalogWarmingHelp")}
            action={
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                {t("platform.retryDiscovery")}
              </Link>
            }
          />
        )}
      </section>

      <section aria-labelledby="how-it-works" className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-primary font-mono text-xs font-semibold tracking-[0.16em] uppercase">
              {t("platform.loopStep")}
            </p>
            <h2
              id="how-it-works"
              className="font-display text-foreground mt-2 text-2xl font-semibold tracking-[0.03em] sm:text-3xl"
            >
              {t("platform.loopTitle")}
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md leading-7">
              {t("platform.loopHelp")}
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              ["01", t("platform.chooseGame"), t("platform.chooseGameHelp")],
              [
                "02",
                t("platform.createSession"),
                t("platform.createSessionHelp"),
              ],
              ["03", t("platform.teamPlay"), t("platform.teamPlayHelp")],
            ].map(([number, title, copy]) => (
              <li
                key={number}
                className="border-border bg-surface/75 shadow-card rounded-lg border p-5"
              >
                <span className="text-primary font-mono text-xs tracking-[0.16em]">
                  {number}
                </span>
                <h3 className="font-display text-foreground mt-5 text-base font-semibold">
                  {title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {copy}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="coming-soon" className="py-12 sm:py-16">
        <Card variant="elevated" className="overflow-hidden">
          <CardHeader className="border-border/70 bg-surface-elevated/65 border-b sm:p-8">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-accent font-mono text-xs font-semibold tracking-[0.16em] uppercase">
                  {t("platform.capabilitiesStep")}
                </p>
                <CardTitle
                  as="h2"
                  id="coming-soon"
                  className="mt-2 text-2xl sm:text-3xl"
                >
                  {t("platform.capabilitiesTitle")}
                </CardTitle>
              </div>
              <Badge variant="outline">{t("platform.roomsAvailable")}</Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-3 p-6 sm:grid-cols-2 sm:p-8 lg:grid-cols-3 xl:grid-cols-5">
            {comingSoon.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="border-border/70 bg-muted/45 rounded-md border p-4"
              >
                <Icon
                  aria-hidden="true"
                  className="text-muted-foreground size-5"
                />
                <h3 className="text-foreground mt-4 text-sm font-semibold">
                  {title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">
                  {description}
                </p>
                <span className="text-muted-foreground mt-4 inline-flex items-center gap-2 font-mono text-[0.65rem] tracking-[0.12em] uppercase">
                  <Gamepad2 aria-hidden="true" className="size-3.5" />{" "}
                  {t("platform.planned")}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
