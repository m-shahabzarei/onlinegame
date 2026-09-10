"use client";

import { ImageOff, ScanLine } from "lucide-react";
import * as React from "react";

import { catalogStatusLabel, type CatalogGame } from "@/domain/catalog";
import { cn } from "@/lib/cn";

export interface GameArtProps {
  className?: string;
  game: Pick<CatalogGame, "name" | "slug" | "status" | "thumbnailUrl">;
  priority?: boolean;
}

/**
 * Stable, local-first cover art. A database thumbnail can be supplied later;
 * the CSS treatment keeps layout dimensions and visual hierarchy intact when
 * no image storage provider has been configured yet.
 */
export function GameArt({
  className,
  game,
  priority = false,
}: GameArtProps): React.JSX.Element {
  const [failedSource, setFailedSource] = React.useState<string | null>(null);

  // Comparing the failed source keeps the fallback reset-free when a parent
  // swaps to a different thumbnail, avoiding a synchronous effect update.
  const imageFailed =
    Boolean(game.thumbnailUrl) && failedSource === game.thumbnailUrl;
  const hasImage = Boolean(game.thumbnailUrl) && !imageFailed;

  return (
    <div
      className={cn(
        "group border-border/80 bg-surface-interactive relative aspect-[16/9] min-h-36 overflow-hidden rounded-md border",
        className,
      )}
      role="img"
      aria-label={`${game.name} cover art`}
    >
      <div
        aria-hidden="true"
        className="from-primary/30 via-surface to-accent/25 absolute inset-0 bg-gradient-to-br"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 [background-image:linear-gradient(to_right,color-mix(in_srgb,var(--border)_35%,transparent)_1px,transparent_1px),linear-gradient(to_bottom,color-mix(in_srgb,var(--border)_35%,transparent)_1px,transparent_1px)] [background-size:2rem_2rem] opacity-50"
      />
      <div
        aria-hidden="true"
        className="bg-primary/20 absolute -end-12 -top-16 size-48 rounded-full blur-3xl transition-transform duration-300 ease-out group-hover:scale-110 motion-reduce:transition-none"
      />
      <div
        aria-hidden="true"
        className="bg-accent/15 absolute -start-10 -bottom-20 size-44 rounded-full blur-3xl"
      />

      {hasImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.thumbnailUrl ?? undefined}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none"
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          onError={() => setFailedSource(game.thumbnailUrl)}
        />
      ) : null}

      <div className="from-background/90 via-background/35 absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t to-transparent p-4 pt-12">
        <div className="min-w-0">
          <p className="text-primary font-mono text-[0.65rem] font-semibold tracking-[0.2em] uppercase">
            {game.slug.replaceAll("-", " ")}
          </p>
          <p className="font-display text-foreground mt-1 truncate text-sm font-semibold tracking-[0.05em]">
            {game.name}
          </p>
        </div>
        {imageFailed ? (
          <span className="border-warning/40 bg-warning-subtle/80 text-warning-foreground inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-1 text-[0.65rem] font-medium">
            <ImageOff aria-hidden="true" className="size-3.5" />
            Art unavailable
          </span>
        ) : (
          <ScanLine
            aria-hidden="true"
            className="text-foreground/70 size-5 shrink-0"
          />
        )}
      </div>

      <span className="border-border/80 bg-background/75 text-foreground/85 absolute start-3 top-3 rounded-full border px-2 py-1 font-mono text-[0.65rem] font-semibold tracking-[0.12em] uppercase backdrop-blur-sm">
        {catalogStatusLabel(game.status)}
      </span>
    </div>
  );
}
