import type { Metadata } from "next";

import { AuthForm } from "@/components/forms";
import { getSafeInternalPath } from "@/lib/safe-internal-path";
import { loginAction } from "@/server/actions/auth";
import { getRequestLocale } from "@/i18n";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your TwoPlayer account.",
};

interface LoginPageProps {
  readonly searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = getSafeInternalPath(params.next);
  const locale = await getRequestLocale();

  return (
    <section className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,0.9fr)_minmax(24rem,1fr)] lg:items-center lg:gap-16 lg:px-8">
      <div className="hidden space-y-5 lg:block">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.24em] uppercase">
          TwoPlayer access
        </p>
        <p className="font-display text-foreground max-w-xl text-4xl leading-tight font-semibold tracking-tight xl:text-5xl">
          Your next co-op run starts here.
        </p>
        <p className="text-muted-foreground max-w-lg text-base leading-7">
          Keep your identity ready for the cooperative games arriving on
          TwoPlayer. Sign in to continue where you left off.
        </p>
      </div>
      <AuthForm
        action={loginAction}
        mode="login"
        nextPath={nextPath}
        locale={locale}
      />
    </section>
  );
}
