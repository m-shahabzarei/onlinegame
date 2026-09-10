"use client";
import Link from "next/link";
import { Button, buttonVariants } from "@/components/ui";
export default function ErrorScreen({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="mx-auto grid max-w-xl gap-5 px-4 py-16">
      <h1 className="font-display text-2xl">Could not load your session</h1>
      <p role="alert">
        Your connection could not be prepared. Retry or return to rooms.
      </p>
      <Button onClick={reset}>Retry</Button>
      <Link
        href="/games/nightfall-protocol/rooms"
        className={buttonVariants({ variant: "secondary" })}
      >
        Return to rooms
      </Link>
    </main>
  );
}
