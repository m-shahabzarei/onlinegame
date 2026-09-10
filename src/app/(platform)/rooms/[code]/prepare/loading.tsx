import { getRequestLocale, createTranslator } from "@/i18n";
import { Skeleton } from "@/components/ui";
export default async function Loading() {
  const t = createTranslator(await getRequestLocale());

  return (
    <div
      className="mx-auto grid max-w-6xl gap-6 px-4 py-8"
      role="status"
      aria-label={t("pages.loadingSessionPreparation")}
    >
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-96" />
    </div>
  );
}
