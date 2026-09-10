"use client";
import { useLocale, useTranslations } from "@/i18n/provider";

import { ArrowUpRight, Clock3, UsersRound } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { type CatalogGame } from "@/domain/catalog";
import {
  localizeCatalogGame,
  localizedCatalogStatus,
  localizedCatalogDifficulty,
} from "@/i18n/catalog";
import { cn } from "@/lib/cn";

import { GameArt } from "./game-art";

export interface GameCardProps {
  className?: string;
  game: CatalogGame;
}

function statusClassName(status: CatalogGame["status"]): string {
  switch (status) {
    case "AVAILABLE":
      return "border-success/35 bg-success-subtle text-success-foreground";
    case "COMING_SOON":
      return "border-primary/35 bg-primary-subtle text-primary";
    case "MAINTENANCE":
      return "border-warning/35 bg-warning-subtle text-warning-foreground";
  }
}

export const GameCard = React.forwardRef<HTMLElement, GameCardProps>(
  ({ className, game: sourceGame }, ref) => {
    const locale = useLocale();
    const t = useTranslations();
    const game = localizeCatalogGame(locale, sourceGame);
    return (
      <article
        ref={ref}
        className={cn(
          "group border-border bg-surface/90 shadow-card hover:border-primary/60 hover:shadow-glow overflow-hidden rounded-lg border transition-[border-color,box-shadow,transform] duration-200 ease-out hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0",
          className,
        )}
      >
        <Link
          href={`/games/${game.slug}`}
          className="focus-visible:ring-ring block min-h-11 rounded-lg focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset"
          aria-label={t("platform.viewGame", { name: game.name })}
        >
          <GameArt game={game} />
          <div className="space-y-4 p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-display text-foreground truncate text-lg font-semibold tracking-[0.03em]">
                  {game.name}
                </h3>
                <p className="text-muted-foreground mt-1 text-xs font-medium tracking-[0.12em] uppercase">
                  {game.genre}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-full border px-2 py-1 text-[0.65rem] font-semibold tracking-[0.08em] uppercase",
                  statusClassName(game.status),
                )}
              >
                {localizedCatalogStatus(locale, game.status)}
              </span>
            </div>

            <p className="text-muted-foreground line-clamp-3 text-sm leading-6">
              {game.description}
            </p>

            <div className="border-border/80 text-muted-foreground grid grid-cols-2 gap-3 border-y py-3 text-xs sm:grid-cols-3">
              <span className="inline-flex items-center gap-2">
                <UsersRound
                  aria-hidden="true"
                  className="text-primary size-4"
                />
                <span>
                  {t("platform.playerCount", { count: game.maxPlayers })}
                </span>
              </span>
              <span className="inline-flex items-center gap-2">
                <Clock3 aria-hidden="true" className="text-primary size-4" />
                <span>
                  {t("platform.duration", { count: game.durationMinutes })}
                </span>
              </span>
              <span className="text-muted-foreground col-span-2 font-mono text-[0.68rem] tracking-[0.1em] uppercase sm:col-span-1 sm:text-end">
                {localizedCatalogDifficulty(locale, game.difficulty)}
              </span>
            </div>

            <div className="text-primary group-hover:text-primary-hover flex items-center justify-between gap-3 text-sm font-semibold transition-colors duration-200">
              <span>{t("platform.viewBrief")}</span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none"
              />
            </div>
          </div>
        </Link>
      </article>
    );
  },
);

GameCard.displayName = "GameCard";
