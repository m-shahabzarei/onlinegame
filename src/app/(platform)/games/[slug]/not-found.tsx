import { getRequestLocale, createTranslator } from "@/i18n";
import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants, EmptyState } from "@/components/ui";

export default async function GameNotFound(): Promise<React.JSX.Element> {
  const t = createTranslator(await getRequestLocale());

  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          titleAs="h1"
          title={t("pages.gameBriefNotFound")}
          description={t("pages.thatGameMayHaveMovedOrIsNotPart")}
          icon={<SearchX aria-hidden="true" />}
          action={
            <Link className={buttonVariants()} href="/games">
              <ArrowLeft aria-hidden="true" className="size-4" />
              {t("pages.browseGames")}
            </Link>
          }
        />
      </div>
    </div>
  );
}
