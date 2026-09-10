"use client";

import { Button, ErrorState } from "@/components/ui";

export default function ProfileError({
  reset,
}: {
  readonly reset: () => void;
}) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <ErrorState
        titleAs="h1"
        title="Profile could not load"
        description="We could not retrieve your profile. Retry the request; your saved identity is still protected."
        action={<Button onClick={reset}>Retry</Button>}
      />
    </section>
  );
}
