"use client";
import Link from "next/link";
import { Button, buttonVariants, Card } from "@/components/ui";
export default function RoomError({ reset }: { reset(): void }) {
  return (
    <div className="px-4 py-12">
      <Card padding="lg" className="mx-auto max-w-xl space-y-5">
        <h1 className="font-display text-2xl">The room could not load</h1>
        <p role="alert" className="text-muted-foreground">
          Your invite is still in the address bar. Retry to restore the latest
          room state.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button onClick={reset}>Retry</Button>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/games/nightfall-protocol/rooms"
          >
            Back to rooms
          </Link>
        </div>
      </Card>
    </div>
  );
}
