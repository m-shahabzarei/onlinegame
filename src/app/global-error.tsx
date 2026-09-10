"use client";

import type { CSSProperties } from "react";
import { useEffect } from "react";

import "./globals.css";

import { Button, ErrorState } from "@/components/ui";

const fallbackFontVariables = {
  "--font-geist": '"Segoe UI"',
  "--font-orbitron": '"Arial Narrow"',
  "--font-geist-mono": '"Cascadia Code"',
  "--font-vazirmatn": "Tahoma",
} as CSSProperties;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Application root error", error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <head>
        <title>TwoPlayer — Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={fallbackFontVariables}>
        <main
          id="main-content"
          className="mx-auto flex min-h-dvh w-full max-w-3xl items-center px-4 py-12 sm:px-6"
        >
          <ErrorState
            className="w-full"
            title="TwoPlayer could not start"
            titleAs="h1"
            description="A root-level error interrupted the interface. Retry once, then inspect the deployment logs if it persists."
            action={<Button onClick={reset}>Restart interface</Button>}
          />
        </main>
      </body>
    </html>
  );
}
