import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "Cosmetics",
  description: "Equip gameplay-neutral TwoPlayer cosmetics.",
};
export default async function CosmeticsPage() {
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
          Identity, not power
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          Cosmetics
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Curated profile presentation only. These selections never change
          damage, health, speed, accuracy or the match economy.
        </p>
      </div>
      {cosmetics.length === 0 ? (
        <EmptyState
          title="Cosmetics are unavailable"
          description="Try again after your profile is ready."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {cosmetics.map((cosmetic) => (
            <Card key={cosmetic.id}>
              <CardHeader>
                <CardTitle as="h2" className="text-lg">
                  {cosmetic.displayName}
                </CardTitle>
                <p className="text-muted-foreground font-mono text-xs uppercase">
                  {cosmetic.kind.replaceAll("_", " ")}
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
                      {cosmetic.equipped ? "Equipped" : "Equip"}
                    </Button>
                  </form>
                ) : (
                  <span className="text-muted-foreground text-sm">
                    Unlock through a curated challenge.
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
