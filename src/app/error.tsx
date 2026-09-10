"use client";

import { useEffect } from "react";

import { Button, ErrorState } from "@/components/ui";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application route error", error);
  }, [error]);

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-12 sm:px-6"
    >
      <ErrorState
        className="w-full"
        title="Interface unavailable"
        titleAs="h1"
        description="The page could not be rendered. Retry the request; if the problem continues, check the server logs."
        action={<Button onClick={reset}>Retry</Button>}
      />
    </main>
  );
}
