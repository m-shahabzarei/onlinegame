import { getRequestLocale, createTranslator } from "@/i18n";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants, EmptyState } from "@/components/ui";

export default async function NotFound() {
  const t = createTranslator(await getRequestLocale());

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-12 sm:px-6"
    >
      <EmptyState
        className="w-full"
        title={t("pages.pageNotFound")}
        titleAs="h1"
        description={t("pages.weCouldNotFindThatTwoPlayerPageCheckThe")}
        action={
          <Link className={buttonVariants()} href="/">
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("pages.backToDiscover")}
          </Link>
        }
      />
    </main>
  );
}
