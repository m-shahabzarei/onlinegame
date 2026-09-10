"use client";
import { useTranslations } from "@/i18n/provider";

import type { CatalogGame } from "@/domain/catalog";
import { cn } from "@/lib/cn";

import { GameCard } from "./game-card";

export interface CatalogGridProps {
  className?: string;
  games: readonly CatalogGame[];
}

export function CatalogGrid({
  className,
  games,
}: CatalogGridProps): React.JSX.Element {
  const t = useTranslations();

  return (
    <div
      aria-label={t("platform.catalogLabel")}
      className={cn(
        "grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3",
        className,
      )}
    >
      {games.map((game) => (
        <GameCard key={game.id} game={game} />
      ))}
    </div>
  );
}
