import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { phase8Service } from "@/server/phase8/service";

export const metadata: Metadata = {
  title: "Challenges",
  description: "Bounded daily and weekly TwoPlayer challenges.",
};
export default async function ChallengesPage() {
  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/challenges");
  let challenges = [] as Awaited<ReturnType<typeof phase8Service.challenges>>;
  try {
    challenges = await phase8Service.challenges(session.userId);
  } catch {
    /* show safe empty state */
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          Keep it focused
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          Challenges
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Server-confirmed progress earns curated cosmetics only. Challenges
          never grant gameplay power or unlimited Scrap.
        </p>
      </div>
      {challenges.length === 0 ? (
        <EmptyState
          title="Challenges are unavailable"
          description="Try again after the challenge service is ready."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {challenges.map((challenge) => (
            <Card key={challenge.id}>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle as="h2" className="text-lg">
                    {challenge.displayCopy}
                  </CardTitle>
                  <span className="text-muted-foreground font-mono text-xs uppercase">
                    {challenge.cadence}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="bg-primary h-full"
                    style={{
                      width: `${Math.min(100, Math.round((challenge.progress / challenge.target) * 100))}%`,
                    }}
                  />
                </div>
                <p className="text-muted-foreground mt-3 text-sm">
                  {challenge.progress} / {challenge.target} ·{" "}
                  {challenge.completedAt ? "Completed" : "In progress"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
