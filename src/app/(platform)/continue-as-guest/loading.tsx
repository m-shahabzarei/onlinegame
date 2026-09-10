import { getRequestLocale, createTranslator } from "@/i18n";
import { Card, Skeleton } from "@/components/ui";

export default async function GuestAccessLoading() {
  const t = createTranslator(await getRequestLocale());

  return (
    <section
      className="mx-auto w-full max-w-lg px-4 py-10 sm:px-6 sm:py-14"
      aria-busy="true"
      aria-label={t("pages.preparingGuestAccess")}
    >
      <Card className="min-h-96 p-6 sm:p-8" variant="elevated">
        <Skeleton className="h-6 w-36" radius="full" />
        <Skeleton className="mt-5 h-10 w-3/4" />
        <Skeleton className="mt-3 h-5 w-full" />
        <div className="mt-8 grid gap-4">
          <Skeleton className="h-12 w-full" radius="md" />
          <Skeleton className="h-12 w-full" radius="md" />
          <Skeleton className="h-12 w-full" radius="md" />
        </div>
      </Card>
    </section>
  );
}
