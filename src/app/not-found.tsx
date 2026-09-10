import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { buttonVariants, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-12 sm:px-6"
    >
      <EmptyState
        className="w-full"
        title="Page not found"
        titleAs="h1"
        description="We could not find that TwoPlayer page. Check the address or return to discovery."
        action={
          <Link className={buttonVariants()} href="/">
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back to discover
          </Link>
        }
      />
    </main>
  );
}
