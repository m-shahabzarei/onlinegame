import { getRequestLocale, createTranslator } from "@/i18n";
import { Card, Skeleton } from "@/components/ui";

export default async function SettingsLoading() {
  const t = createTranslator(await getRequestLocale());

  return (
    <section
      className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      aria-busy="true"
      aria-label={t("pages.loadingAccountSettings")}
    >
      <div>
        <Skeleton className="h-4 w-32" radius="full" />
        <Skeleton className="mt-5 h-10 w-52" />
        <Skeleton className="mt-3 h-5 w-full max-w-xl" />
      </div>
      <Card className="min-h-[24rem] p-6 sm:p-8" variant="elevated">
        <Skeleton className="h-7 w-40" />
        <div className="mt-8 grid gap-5">
          <Skeleton className="h-12 w-full" radius="md" />
          <Skeleton className="h-16 w-full" radius="md" />
          <Skeleton className="h-16 w-full" radius="md" />
        </div>
      </Card>
    </section>
  );
}
