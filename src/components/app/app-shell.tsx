import type { ReactNode } from "react";
import Link from "next/link";

import type { SafeUser } from "@/domain";
import { getCurrentSession } from "@/server/dal/session";

import { MobileNav } from "./mobile-nav";
import { PresenceSummary } from "@/components/lobby/presence-summary";
import { Onboarding } from "@/components/onboarding/onboarding";
import { RouteProgress } from "@/components/navigation/route-progress";
import { getRequestLocale } from "@/i18n";

export interface AppShellProps {
  children: ReactNode;
  eyebrow?: string;
  user?: SafeUser | null;
}

/** Shared platform chrome with request-scoped account presentation preferences. */
export async function AppShell({
  children,
  eyebrow = "TACTICAL CO-OP PLATFORM",
  user,
}: AppShellProps) {
  const resolvedUser =
    user === undefined ? ((await getCurrentSession())?.user ?? null) : user;
  const locale = await getRequestLocale();

  return (
    <div
      className="min-h-dvh overflow-x-clip"
      data-reduce-motion={resolvedUser?.reducedMotion ? "true" : undefined}
    >
      <header className="border-border/80 bg-background/85 sticky top-0 z-40 border-b backdrop-blur-xl">
        <RouteProgress />
        <div className="mx-auto flex min-h-16 w-full max-w-screen-2xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 2xl:px-12">
          <Link
            href="/"
            className="group focus-visible:ring-ring focus-visible:ring-offset-background inline-flex min-h-11 items-center gap-3 rounded-md focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            <span
              aria-hidden="true"
              className="border-primary/60 bg-primary-subtle shadow-glow relative grid size-9 place-items-center overflow-hidden rounded-md border"
            >
              <span className="border-primary/40 absolute inset-1 rounded-sm border" />
              <span className="font-display text-primary relative text-sm font-bold">
                2P
              </span>
            </span>
            <span className="grid leading-none">
              <span className="font-display text-foreground group-hover:text-primary text-sm font-bold tracking-[0.16em] uppercase transition-colors duration-200">
                TwoPlayer
              </span>
              <span className="text-muted-foreground mt-1 hidden font-mono text-[0.6rem] tracking-[0.18em] uppercase lg:block">
                {eyebrow}
              </span>
            </span>
          </Link>
          <MobileNav user={resolvedUser} locale={locale} />
        </div>
      </header>
      <main id="main-content">{children}</main>
      <Onboarding />
      <footer className="border-border/70 mx-auto mt-20 w-full max-w-screen-2xl border-t px-4 py-8 sm:px-6 lg:px-8 2xl:px-12">
        <div className="text-muted-foreground flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>TwoPlayer · cooperative play, built with intent.</p>
          <p className="font-mono text-xs tracking-[0.12em] uppercase">
            Rooms and gameplay are live · Play with care
          </p>
        </div>
        <div className="mt-4">
          <PresenceSummary signedIn={!!resolvedUser} />
        </div>
      </footer>
    </div>
  );
}
