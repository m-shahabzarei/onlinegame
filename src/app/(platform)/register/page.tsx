import type { Metadata } from "next";

import { AuthForm } from "@/components/forms";
import { getSafeInternalPath } from "@/lib/safe-internal-path";
import { registerAction } from "@/server/actions/auth";
import { getRequestLocale } from "@/i18n";

export const metadata: Metadata = {
  title: "Create account",
  description: "Create a TwoPlayer account and set up your player identity.",
};

interface RegisterPageProps {
  readonly searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}

export default async function RegisterPage({
  searchParams,
}: RegisterPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = getSafeInternalPath(params.next);
  const locale = await getRequestLocale();

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1fr)] lg:items-center lg:gap-16 lg:px-8">
      <div className="hidden space-y-5 lg:block">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.24em] uppercase">
          Build your identity
        </p>
        <p className="font-display text-foreground max-w-xl text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
          Make your place in the squad.
        </p>
        <p className="text-muted-foreground max-w-lg text-base leading-7">
          Your account keeps your profile ready for future sessions. Rooms and
          matchmaking will arrive in a later phase.
        </p>
      </div>
      <AuthForm
        action={registerAction}
        mode="register"
        nextPath={nextPath}
        locale={locale}
      />
    </section>
  );
}
