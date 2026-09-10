import { ArrowLeft, SearchX } from "lucide-react";
import Link from "next/link";

import { buttonVariants, EmptyState } from "@/components/ui";

export default function GameNotFound(): React.JSX.Element {
  return (
    <div className="min-h-dvh px-4 py-12 sm:px-6 lg:py-16">
      <div className="mx-auto w-full max-w-3xl">
        <EmptyState
          titleAs="h1"
          title="Game brief not found"
          description="That game may have moved or is not part of the current catalog. Return to the catalog to browse the available briefs."
          icon={<SearchX aria-hidden="true" />}
          action={
            <Link className={buttonVariants()} href="/games">
              <ArrowLeft aria-hidden="true" className="size-4" />
              Browse games
            </Link>
          }
        />
      </div>
    </div>
  );
}
