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

const comingSoon = [
  {
    icon: LockKeyhole,
    title: "Private rooms",
    description: "Available now. Create a focused room for your partner.",
  },
  {
    icon: Link2,
    title: "Invite links",
    description: "Available now. Share a secure path to your room.",
  },
  {
    icon: UsersRound,
    title: "Co-op matchmaking",
    description:
      "Planned for a later phase. Automatic partner selection is not available.",
  },
  {
    icon: Mic2,
    title: "Voice chat",
    description: "Not available. TwoPlayer does not include voice chat.",
  },
  {
    icon: ShieldCheck,
    title: "Match history",
    description: "Available now. Review completed runs and team milestones.",
  },
] as const;

export function HomePage({ featuredGames, user }: HomePageProps) {
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
            Cooperative sessions, live now
          </Badge>
          <h1 className="font-display text-foreground mt-6 max-w-3xl text-4xl leading-[1.08] font-bold tracking-[0.015em] sm:text-5xl lg:text-7xl">
            Make the next run <span className="text-primary">count.</span>
          </h1>
          <p className="text-muted-foreground mt-6 max-w-2xl text-base leading-7 sm:text-lg sm:leading-8">
            TwoPlayer is a focused home for cooperative games: choose a world,
            find your rhythm, and take on the hard moments together. Discovery,
            rooms and cooperative gameplay are available today. Find a partner,
            prepare together, and make the next run count.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/games" className={buttonVariants({ size: "lg" })}>
              Explore games
              <ArrowRight aria-hidden="true" className="size-5" />
            </Link>
            <Link
              href={user ? "/profile" : "/continue-as-guest"}
              className={cn(
                buttonVariants({ size: "lg", variant: "ghost" }),
                "text-muted-foreground",
              )}
            >
              {user ? "Review your profile" : "Browse as a guest"}
            </Link>
          </div>
          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm">
            <span className="text-muted-foreground inline-flex items-center gap-2">
              <Check aria-hidden="true" className="text-success size-4" />
              No account required to discover
            </span>
            <span className="text-muted-foreground inline-flex items-center gap-2">
              <Check aria-hidden="true" className="text-success size-4" />
              Built for two-player focus
            </span>
          </div>
        </div>
      </section>

      <section aria-labelledby="featured-games" className="py-12 sm:py-16">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-primary font-mono text-xs font-semibold tracking-[0.16em] uppercase">
              01 / Discover
            </p>
            <h2
              id="featured-games"
              className="font-display text-foreground mt-2 text-2xl font-semibold tracking-[0.03em] sm:text-3xl"
            >
              Find your next co-op world
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
              A small, intentional catalog while the platform comes online.
              Every title has a clear status so you know what you can explore
              now.
            </p>
          </div>
          <Link
            href="/games"
            className="text-primary hover:text-primary-hover focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold focus-visible:ring-2 focus-visible:outline-none"
          >
            View full catalog{" "}
            <ArrowRight aria-hidden="true" className="size-4" />
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
            title="The catalog is warming up"
            description="No games are available right now. Retry discovery or use the main navigation while the next brief is prepared."
            action={
              <Link href="/" className={buttonVariants({ variant: "outline" })}>
                Retry discovery
              </Link>
            }
          />
        )}
      </section>

      <section aria-labelledby="how-it-works" className="py-12 sm:py-16">
        <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div>
            <p className="text-primary font-mono text-xs font-semibold tracking-[0.16em] uppercase">
              02 / The loop
            </p>
            <h2
              id="how-it-works"
              className="font-display text-foreground mt-2 text-2xl font-semibold tracking-[0.03em] sm:text-3xl"
            >
              A calm path to a good session
            </h2>
            <p className="text-muted-foreground mt-4 max-w-md leading-7">
              Discover the worlds, invite a partner, and prepare your room.
              Enter the match together and rely on server-confirmed results.
            </p>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {[
              [
                "01",
                "Choose a game",
                "Explore the catalog and understand the experience before you commit.",
              ],
              [
                "02",
                "Create a session",
                "Create a public or private room and share the invite with your partner.",
              ],
              [
                "03",
                "Team up and play",
                "Enter the match together and rely on server-confirmed results.",
              ],
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
                  03 / Platform capabilities
                </p>
                <CardTitle
                  as="h2"
                  id="coming-soon"
                  className="mt-2 text-2xl sm:text-3xl"
                >
                  Your coordination layer
                </CardTitle>
              </div>
              <Badge variant="outline">Rooms available · More to come</Badge>
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
                  <Gamepad2 aria-hidden="true" className="size-3.5" /> Planned
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
