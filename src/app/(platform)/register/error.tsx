"use client";

import Link from "next/link";

import { Button, buttonVariants, ErrorState } from "@/components/ui";

export default function RegisterError({
  reset,
}: {
  readonly reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title="Registration is unavailable"
        description="We could not load account registration. Retry the request, or sign in if you already have a TwoPlayer account."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Retry registration</Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/login"
            >
              Go to sign in
            </Link>
          </div>
        }
      />
    </section>
  );
}
