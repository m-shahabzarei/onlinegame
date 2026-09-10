import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
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
  title: "Match history",
  description: "Review your completed TwoPlayer runs.",
};

export default async function HistoryPage() {
  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/history");
  let history;
  try {
    history = await phase8Service.history(session.userId);
  } catch {
    history = { items: [], nextCursor: null };
  }
  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          Your runs
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          Match history
        </h1>
        <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
          Only your authorized match summaries appear here. High-frequency
          gameplay state is never stored in this view.
        </p>
      </div>
      {history.items.length === 0 ? (
        <EmptyState
          title="No completed runs yet"
          description="Finish a cooperative run and its summary will appear here."
          action={
            <Link
              className="text-primary font-semibold underline-offset-4 hover:underline"
              href="/games"
            >
              Choose a game
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4">
          {history.items.map((item) => (
            <Card key={item.id}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle as="h2">{item.game.name}</CardTitle>
                  <span
                    className={
                      item.result === "VICTORY" ||
                      item.result === "PHASE_COMPLETE"
                        ? "text-success font-semibold"
                        : "text-warning font-semibold"
                    }
                  >
                    {item.result === "VICTORY"
                      ? "Victory"
                      : item.result === "PHASE_COMPLETE"
                        ? "Complete"
                        : "Defeat"}
                  </span>
                </div>
                <p className="text-muted-foreground text-sm">
                  {item.createdAt.toLocaleString("en", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </p>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground block">Waves</span>
                  <strong>{item.completedWaves}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Score</span>
                  <strong>{item.score}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">
                    Contribution
                  </span>
                  <strong>{item.contribution}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground block">Revives</span>
                  <strong>{item.revives}</strong>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
