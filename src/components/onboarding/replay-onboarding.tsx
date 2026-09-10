"use client";
import { useTranslations } from "@/i18n/provider";

import { useState } from "react";
import { Button } from "@/components/ui";
import { Onboarding } from "./onboarding";

export function ReplayOnboarding() {
  const t = useTranslations();

  const [session, setSession] = useState(0);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setSession((value) => value + 1)}
      >
        {t("platform.replayOnboarding")}
      </Button>
      {session > 0 ? <Onboarding key={session} forceOpen /> : null}
    </>
  );
}
