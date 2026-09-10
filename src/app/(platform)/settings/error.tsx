"use client";

import Link from "next/link";

import { Button, buttonVariants, ErrorState } from "@/components/ui";

export default function SettingsError({
  reset,
}: {
  readonly reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title="Settings could not load"
        description="We could not retrieve your saved preferences. Retry the request, or return to your profile without changing anything."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Retry settings</Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/profile"
            >
              Back to profile
            </Link>
          </div>
        }
      />
    </section>
  );
}
