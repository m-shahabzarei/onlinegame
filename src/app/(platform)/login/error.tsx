"use client";

import Link from "next/link";

import { Button, buttonVariants, ErrorState } from "@/components/ui";

export default function LoginError({ reset }: { readonly reset: () => void }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title="Sign in is unavailable"
        description="We could not load the sign-in form. Retry the request, or continue as a guest while the account service recovers."
        action={
          <div className="flex flex-wrap justify-center gap-3">
            <Button onClick={reset}>Retry sign in</Button>
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/continue-as-guest"
            >
              Continue as guest
            </Link>
          </div>
        }
      />
    </section>
  );
}
