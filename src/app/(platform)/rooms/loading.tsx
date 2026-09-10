import { getRequestLocale, createTranslator } from "@/i18n";
import { Skeleton } from "@/components/ui";
export default async function LoadingRooms() {
  const t = createTranslator(await getRequestLocale());

  return (
    <div
      className="mx-auto max-w-6xl space-y-6 px-4 py-12"
      role="status"
      aria-label={t("pages.loadingRoom")}
    >
      <Skeleton className="h-16" />
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );
}
