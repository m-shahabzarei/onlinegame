import type { Metadata } from "next";

import { GuestForm } from "@/components/forms";
import { getSafeInternalPath } from "@/lib/safe-internal-path";
import { guestAction } from "@/server/actions/auth";
import { getRequestLocale } from "@/i18n";

export const metadata: Metadata = {
  title: "Continue as guest",
  description: "Explore TwoPlayer with a temporary guest identity.",
};

interface GuestPageProps {
  readonly searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}

export default async function ContinueAsGuestPage({
  searchParams,
}: GuestPageProps) {
  const params = (await searchParams) ?? {};
  const nextPath = getSafeInternalPath(params.next);
  const locale = await getRequestLocale();

  return (
    <section className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <GuestForm action={guestAction} nextPath={nextPath} locale={locale} />
    </section>
  );
}
