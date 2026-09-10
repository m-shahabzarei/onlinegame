import type {
  CatalogDifficulty,
  CatalogGame,
  CatalogGameStatus,
} from "@/domain/catalog";
import { createTranslator } from "./client";
import type { Locale } from "./messages";

/** Catalog identifiers remain stable; product prose is resolved only at presentation. */
export function localizedCatalogStatus(
  locale: Locale,
  status: CatalogGameStatus,
): string {
  const t = createTranslator(locale);
  return {
    AVAILABLE: t("platform.available"),
    COMING_SOON: t("platform.comingSoon"),
    MAINTENANCE: t("platform.maintenance"),
  }[status];
}
export function localizedCatalogDifficulty(
  locale: Locale,
  difficulty: CatalogDifficulty,
): string {
  const t = createTranslator(locale);
  return {
    RECRUIT: t("platform.recruit"),
    TACTICAL: t("platform.tactical"),
    VETERAN: t("platform.veteran"),
  }[difficulty];
}
type CatalogCopy = Pick<
  CatalogGame,
  "name" | "description" | "genre" | "overview" | "tags" | "features"
>;
export function catalogCopy(locale: Locale, slug: string): CatalogCopy {
  const t = createTranslator(locale);
  switch (slug) {
    case "nightfall-protocol":
      return {
        name: t("platform.nightfallName"),
        description: t("platform.nightfallDescription"),
        genre: t("platform.nightfallGenre"),
        overview: t("platform.nightfallOverview"),
        tags: [
          t("platform.tagCoop"),
          t("platform.tagFirstPerson"),
          t("platform.tagZombie"),
        ],
        features: [
          t("platform.nightfallFeature1"),
          t("platform.nightfallFeature2"),
          t("platform.nightfallFeature3"),
          t("platform.nightfallFeature4"),
        ],
      };
    case "signal-wardens":
      return {
        name: t("platform.signalName"),
        description: t("platform.signalDescription"),
        genre: t("platform.signalGenre"),
        overview: t("platform.signalOverview"),
        tags: [
          t("platform.tagCoop"),
          t("platform.tactical"),
          t("platform.tagPreview"),
        ],
        features: [
          t("platform.signalFeature1"),
          t("platform.signalFeature2"),
          t("platform.signalFeature3"),
        ],
      };
    case "emberline":
      return {
        name: t("platform.emberName"),
        description: t("platform.emberDescription"),
        genre: t("platform.emberGenre"),
        overview: t("platform.emberOverview"),
        tags: [
          t("platform.tagCoop"),
          t("platform.tagSquad"),
          t("platform.tagDevelopment"),
        ],
        features: [
          t("platform.emberFeature1"),
          t("platform.emberFeature2"),
          t("platform.emberFeature3"),
        ],
      };
    default:
      return {
        name: t("platform.genericGameName"),
        description: t("platform.genericGameDescription"),
        genre: t("platform.genericGenre"),
        overview: t("platform.genericGameDescription"),
        tags: [],
        features: [],
      };
  }
}
export function localizeCatalogGame(
  locale: Locale,
  game: CatalogGame,
): CatalogGame {
  return { ...game, ...catalogCopy(locale, game.slug) };
}
