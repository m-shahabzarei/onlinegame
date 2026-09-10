import { getRequestLocale, createTranslator } from "@/i18n";
import Link from "next/link";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const t = createTranslator(await getRequestLocale());
  return {
    title: t("pages.scheduledMaintenance"),
    description: t(
      "pages.twoPlayerIsTemporarilyUnavailableWhileWeProtectActiveSessions",
    ),
  };
}
export default async function MaintenancePage() {
  const t = createTranslator(await getRequestLocale());

  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <section className="max-w-lg text-center">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {t("pages.scheduledMaintenance")}
        </p>
        <h1 className="font-display text-foreground mt-4 text-4xl font-semibold">
          {t("pages.weAreTuningTheConnection")}
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">
          {t(
            "pages.twoPlayerIsTemporarilyUnavailableWhileWeProtectActiveSessions",
          )}
        </p>
        <Link className="mt-8 inline-flex" href="/">
          <Button type="button">{t("pages.tryAgain")}</Button>
        </Link>
      </section>
    </main>
  );
}
