import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  ShieldAlert,
  UsersRound,
} from "lucide-react";

import {
  catalogDifficultyLabel,
  catalogStatusLabel,
  type CatalogGame,
} from "@/domain/catalog";
import {
  Badge,
  buttonVariants,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { GameArt } from "@/components/catalog/game-art";
import { getCatalogGame } from "@/server/catalog";

interface GameDetailsPageProps {
  params: Promise<{ slug: string }>;
}

// Details resolve at request time while their shared catalog read remains cached.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: GameDetailsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const game = await getCatalogGame(slug);

  if (!game) {
    return {
      title: "Game not found",
      description: "The requested TwoPlayer game brief could not be found.",
    };
  }

  return {
    title: game.name,
    description: game.description,
  };
}

function statusVariant(
  status: CatalogGame["status"],
): "success" | "primary" | "warning" {
  switch (status) {
    case "AVAILABLE":
      return "success";
    case "COMING_SOON":
      return "primary";
    case "MAINTENANCE":
      return "warning";
  }
}

function actionCopy(status: CatalogGame["status"]): string {
  switch (status) {
    case "AVAILABLE":
      return "Room preparation is available for Nightfall Protocol";
    case "COMING_SOON":
      return "This game is being prepared for a future phase";
    case "MAINTENANCE":
      return "This game brief is temporarily under maintenance";
  }
}

function GameDetailsContent({ game }: { game: CatalogGame }) {
  return (
    <>
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <Link
          className={buttonVariants({ variant: "ghost", size: "sm" })}
          href="/games"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to games
        </Link>
        <span className="text-muted-foreground font-mono text-xs tracking-[0.12em] uppercase">
          Game brief · No live session data
        </span>
      </div>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)] lg:items-start lg:gap-12">
        <div className="space-y-6">
          <GameArt
            game={game}
            priority
            className="rounded-xl sm:[&>div:last-child]:p-8 sm:[&>div:last-child]:pt-32"
          />
          <p className="text-muted-foreground max-w-2xl text-base leading-7 sm:text-lg">
            {game.description}
          </p>
        </div>

        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={statusVariant(game.status)}>
              {catalogStatusLabel(game.status)}
            </Badge>
            {game.tags.map((tag) => (
              <Badge key={tag} variant="outline" size="sm">
                {tag}
              </Badge>
            ))}
          </div>
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-[0.03em] sm:text-4xl">
            {game.name}
          </h1>
          <div className="border-border bg-surface/80 shadow-card grid grid-cols-3 gap-2 rounded-lg border p-3">
            <div className="border-border/80 space-y-1 border-e pe-2">
              <UsersRound aria-hidden="true" className="text-primary size-4" />
              <p className="text-muted-foreground font-mono text-xs uppercase">
                Players
              </p>
              <p className="text-foreground text-sm font-semibold">
                Up to {game.maxPlayers}
              </p>
            </div>
            <div className="border-border/80 space-y-1 border-e pe-2">
              <Clock3 aria-hidden="true" className="text-primary size-4" />
              <p className="text-muted-foreground font-mono text-xs uppercase">
                Session
              </p>
              <p className="text-foreground text-sm font-semibold">
                ~{game.durationMinutes} min
              </p>
            </div>
            <div className="space-y-1">
              <ShieldAlert aria-hidden="true" className="text-primary size-4" />
              <p className="text-muted-foreground font-mono text-xs uppercase">
                Difficulty
              </p>
              <p className="text-foreground text-sm font-semibold">
                {catalogDifficultyLabel(game.difficulty)}
              </p>
            </div>
          </div>

          <Card id="availability" variant="subtle" padding="md">
            <div className="flex items-start gap-3">
              <span className="border-primary/35 bg-primary-subtle text-primary mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-md border">
                <ShieldAlert aria-hidden="true" className="size-4" />
              </span>
              <div>
                <h2 className="font-display text-foreground text-sm font-semibold tracking-[0.03em]">
                  Platform availability
                </h2>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  {game.slug === "nightfall-protocol"
                    ? "Create a public or private room, invite a partner, and prepare a two-player session. Actual gameplay arrives in Phase 4."
                    : `${actionCopy(game.status)}. Gameplay is not available yet.`}
                </p>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-3">
              <Link
                className={buttonVariants({ variant: "primary", size: "sm" })}
                href={
                  game.slug === "nightfall-protocol"
                    ? `/games/${game.slug}/rooms`
                    : "#experience-overview"
                }
              >
                {game.slug === "nightfall-protocol"
                  ? "Browse rooms"
                  : "Review preparation brief"}
              </Link>
              <Link
                className={buttonVariants({ variant: "outline", size: "sm" })}
                href="/games"
              >
                Browse catalog
              </Link>
            </div>
          </Card>
        </div>
      </section>

      <section
        id="experience-overview"
        className="mt-12 grid scroll-mt-24 gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(18rem,0.9fr)]"
      >
        <Card variant="default" padding="md">
          <CardHeader className="p-0 pb-5">
            <p className="text-primary font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Experience overview
            </p>
            <CardTitle as="h2" className="mt-2 text-xl">
              What to expect
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <p className="text-muted-foreground max-w-2xl text-base leading-7">
              {game.overview}
            </p>
          </CardContent>
        </Card>

        <Card variant="elevated" padding="md">
          <CardHeader className="p-0 pb-5">
            <p className="text-primary font-mono text-xs font-semibold tracking-[0.18em] uppercase">
              Planned systems
            </p>
            <CardTitle as="h2" className="mt-2 text-xl">
              Feature direction
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="space-y-3">
              {game.features.map((feature) => (
                <li
                  key={feature}
                  className="text-muted-foreground flex items-start gap-3 text-sm leading-6"
                >
                  <span className="border-success/35 bg-success-subtle text-success-foreground mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full border">
                    <Check aria-hidden="true" className="size-3.5" />
                  </span>
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      <p className="text-muted-foreground mt-10 text-center font-mono text-xs tracking-[0.12em] uppercase">
        Prepare your team in the room lobby · Gameplay arrives in Phase 4.
      </p>
    </>
  );
}

export default async function GameDetailsPage({
  params,
}: GameDetailsPageProps): Promise<React.JSX.Element> {
  const { slug } = await params;
  const game = await getCatalogGame(slug);

  if (!game) {
    notFound();
  }

  return (
    <div className="min-h-dvh px-4 py-10 sm:px-6 lg:py-14">
      <div className="mx-auto w-full max-w-7xl">
        <GameDetailsContent game={game} />
      </div>
    </div>
  );
}
