"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { Onboarding } from "./onboarding";

export function ReplayOnboarding() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        Replay onboarding
      </Button>
      {open ? <Onboarding forceOpen /> : null}
    </>
  );
}
