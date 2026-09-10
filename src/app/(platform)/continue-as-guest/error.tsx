"use client";

import Link from "next/link";

import { Button, buttonVariants, ErrorState } from "@/components/ui";

export default function GuestAccessError({
  reset,
}: {
  readonly reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title="Guest access is unavailable"
        description="We could not prepare a temporary guest session. Retry now, or browse the public game catalog without starting a guest session."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Retry guest access</Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/games"
            >
              Browse games
            </Link>
          </div>
        }
      />
    </section>
  );
}
