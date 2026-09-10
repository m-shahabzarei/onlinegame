import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";

import { ProfileForm, LogoutButton } from "@/components/forms";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui";
import { getStrictCurrentSession } from "@/server/dal/session";
import { logoutAction } from "@/server/actions/auth";
import { updateProfileAction } from "@/server/actions/profile";
import { phase8Service } from "@/server/phase8/service";

export const metadata: Metadata = {
  title: "Profile",
  description: "Manage your TwoPlayer player identity.",
};

export default async function ProfilePage() {
  const session = await getStrictCurrentSession();
  if (!session) redirect("/login?next=/profile");

  const user = session.user;
  const createdAt = user.createdAt.toISOString();
  let summary: Awaited<ReturnType<typeof phase8Service.profileSummary>> | null =
    null;
  try {
    summary = await phase8Service.profileSummary(user.id);
  } catch {
    summary = null;
  }

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,0.75fr)] lg:px-8">
      <div className="grid gap-6">
        <div className="space-y-3">
          <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
            Account identity
          </p>
          <h1 className="font-display text-foreground text-3xl font-semibold tracking-tight sm:text-4xl">
            Your profile
          </h1>
          <p className="text-muted-foreground max-w-2xl leading-7">
            Choose how you appear across TwoPlayer, then review recent runs and
            challenges as they become available.
          </p>
        </div>
        {user.isGuest ? (
          <Card variant="subtle" className="border-warning/35">
            <CardContent className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div>
                <Badge variant="warning">Temporary guest profile</Badge>
                <p className="text-muted-foreground mt-3 max-w-xl text-sm leading-6">
                  This identity is temporary. Registration creates a separate
                  permanent profile; edits made here will not transfer to it.
                </p>
              </div>
              <Link
                className="text-primary focus-visible:ring-ring min-h-11 rounded-md px-2 py-3 text-sm font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                href="/register"
              >
                Create an account
              </Link>
            </CardContent>
          </Card>
        ) : null}
        <ProfileForm
          action={updateProfileAction}
          user={{
            username: user.username,
            displayName: user.displayName,
            avatarUrl: user.avatarUrl,
            bio: user.bio,
          }}
        />
      </div>

      <aside className="grid content-start gap-6">
        <Card>
          <CardHeader>
            <CardTitle as="h2">Account status</CardTitle>
            <CardDescription>
              Persistent identity details only. No gameplay stats are fabricated
              here.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm">
            <div className="border-border flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={user.isGuest ? "warning" : "success"}>
                {user.isGuest ? "Guest" : "Active"}
              </Badge>
            </div>
            <div className="border-border flex items-center justify-between gap-4 border-b pb-3">
              <span className="text-muted-foreground">Joined</span>
              <time className="text-foreground text-end" dateTime={createdAt}>
                {user.createdAt.toLocaleDateString("en", {
                  dateStyle: "medium",
                })}
              </time>
            </div>
            <div className="grid gap-1">
              <span className="text-muted-foreground">Match history</span>
              {summary ? (
                <span className="text-foreground">
                  {summary.matchesCompleted} completed · {summary.wins} wins
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Not enough data yet
                </span>
              )}
            </div>
            <Link
              className="text-primary font-semibold underline-offset-4 hover:underline"
              href={"/history" as never}
            >
              View match history
            </Link>
          </CardContent>
        </Card>
        <Card variant="subtle">
          <CardHeader>
            <CardTitle as="h2">Session</CardTitle>
            <CardDescription>
              Sign out safely on shared devices.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LogoutButton action={logoutAction} />
          </CardContent>
        </Card>
      </aside>
    </section>
  );
}
