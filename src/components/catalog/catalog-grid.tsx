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
  return (
    <div
      aria-label="Game catalog"
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
