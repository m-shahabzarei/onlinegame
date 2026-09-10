import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { SafetyForm } from "@/components/safety/safety-form";

export const metadata: Metadata = {
  title: "Trust and safety",
  description: "Report, block and manage player safety concerns.",
};
export default async function SafetyPage() {
  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/safety");
  return (
    <section className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div>
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          Play with care
        </p>
        <h1 className="font-display text-foreground mt-2 text-3xl font-semibold sm:text-4xl">
          Trust and safety
        </h1>
        <p className="text-muted-foreground mt-3 leading-7">
          Reports are private, rate-limited and reviewed separately from
          gameplay. A single report never automatically bans a player.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Report a player</CardTitle>
          <CardDescription>
            Use the player identifier shown in an authorized match context. Do
            not include passwords, tokens or private personal information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SafetyForm />
        </CardContent>
      </Card>
      <Card variant="subtle">
        <CardHeader>
          <CardTitle as="h2">Community guidelines</CardTitle>
        </CardHeader>
        <CardContent className="text-muted-foreground space-y-2 text-sm leading-6">
          <p>
            Coordinate respectfully. Do not exploit bugs, harass teammates or
            attempt to access rooms and matches you were not invited to.
          </p>
          <p>
            Text and voice chat are not available in TwoPlayer yet, so mute
            applies to future supported communication channels only.
          </p>
        </CardContent>
      </Card>
    </section>
  );
}
