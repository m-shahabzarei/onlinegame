import { localizedCosmeticName } from "@/i18n/phase8";
import { getRequestLocale, createTranslator } from "@/i18n";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  EmptyState,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { phase8Service } from "@/server/phase8/service";

export async function generateMetadata() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);
  return {
    title: t("pages.cosmetics"),
    description: t("pages.equipGameplayneutralTwoPlayerCosmetics"),
  };
}
export default async function CosmeticsPage() {
  const locale = await getRequestLocale();
  const t = createTranslator(locale);

  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/cosmetics");
  let cosmetics = [] as Awaited<ReturnType<typeof phase8Service.cosmetics>>;
  try {
    cosmetics = await phase8Service.cosmetics(session.userId);
  } catch {
    /* safe empty state */
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {t("pages.identityNotPower")}
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          {t("pages.cosmetics")}
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          {t(
            "pages.curatedProfilePresentationOnlyTheseSelectionsNeverChangeDamage",
          )}
        </p>
      </div>
      {cosmetics.length === 0 ? (
        <EmptyState
          title={t("pages.cosmeticsAreUnavailable")}
          description={t("pages.tryAgainAfterYourProfileIsReady")}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cosmetics.map((cosmetic) => (
            <Card key={cosmetic.id}>
              <CardHeader>
                <CardTitle as="h2" className="text-lg">
                  {localizedCosmeticName(locale, cosmetic.id)}
                </CardTitle>
                <p className="text-muted-foreground font-mono text-xs uppercase">
                  {t(`cosmeticKinds.${cosmetic.kind}`)}
                </p>
              </CardHeader>
              <CardContent>
                {cosmetic.owned ? (
                  <form
                    action={async () => {
                      "use server";
                      await phase8Service.equipCosmetic(
                        session.userId,
                        cosmetic.id,
                      );
                    }}
                  >
                    <Button
                      type="submit"
                      variant={cosmetic.equipped ? "secondary" : "outline"}
                    >
                      {cosmetic.equipped
                        ? t("pages.equipped")
                        : t("pages.equip")}
                    </Button>
                  </form>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    {t("pages.unlockThroughACuratedChallenge")}
                  </span>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
