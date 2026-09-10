import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LogoutButton, SettingsForm } from "@/components/forms";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { logoutAction } from "@/server/actions/auth";
import { updateSettingsAction } from "@/server/actions/settings";
import { getStrictCurrentSession } from "@/server/dal/session";
import { ReplayOnboarding } from "@/components/onboarding/replay-onboarding";

export const metadata: Metadata = {
  title: "Settings",
  description: "Manage your TwoPlayer account and experience preferences.",
};

export default async function SettingsPage() {
  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/settings");

  const user = session.user;

  return (
    <section className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
      <div className="space-y-3">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          Control room
        </p>
        <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
          Settings
        </h1>
        <p className="text-muted-foreground max-w-2xl leading-7">
          Tune your account preferences. Sound is represented here as a
          placeholder until the game client arrives.
        </p>
      </div>
      <SettingsForm
        action={updateSettingsAction}
        values={{
          locale: user.locale,
          reducedMotion: user.reducedMotion,
          soundEnabled: user.soundEnabled,
        }}
      />
      <Card variant="subtle">
        <CardHeader>
          <CardTitle as="h2">Getting started</CardTitle>
          <CardDescription>
            Review room, match and control guidance whenever you need it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ReplayOnboarding />
        </CardContent>
      </Card>
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Account session</CardTitle>
            <CardDescription>End this browser session safely.</CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton action={logoutAction} />
          </CardContent>
        </Card>
        <Card variant="subtle" className="border-border-strong/70">
          <CardHeader>
            <CardTitle as="h2">Delete account</CardTitle>
            <CardDescription>
              Account deletion will be available only with a verified,
              reversible flow.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center justify-between gap-4">
            <Badge variant="neutral">Not available yet</Badge>
            <Button
              type="button"
              variant="outline"
              disabled
              aria-disabled="true"
            >
              Request deletion
            </Button>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
