import Link from "next/link";
import { Button } from "@/components/ui";

export const dynamic = "force-dynamic";
export default function MaintenancePage() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <section className="max-w-lg text-center">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          Scheduled maintenance
        </p>
        <h1 className="font-display text-foreground mt-4 text-4xl font-semibold">
          We are tuning the connection
        </h1>
        <p className="text-muted-foreground mt-4 leading-7">
          TwoPlayer is temporarily unavailable while we protect active sessions.
          Please try again shortly.
        </p>
        <Link className="mt-8 inline-flex" href="/">
          <Button type="button">Try again</Button>
        </Link>
      </section>
    </main>
  );
}
