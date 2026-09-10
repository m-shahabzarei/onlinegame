import { getRequestLocale, createTranslator } from "@/i18n";
export default async function Loading() {
  const t = createTranslator(await getRequestLocale());

  return (
    <main id="main-content" className="grid min-h-dvh place-items-center p-6">
      <p role="status">{t("pages.checkingYourTrainingReservation")}</p>
    </main>
  );
}
