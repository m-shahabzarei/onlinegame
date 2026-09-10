"use client";
import { actionMessage } from "@/i18n/action-messages";
import { useLocale, useTranslations } from "@/i18n/provider";

import { LogOut } from "lucide-react";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui";

import type { FormAction } from "./auth-form";
import { initialFormActionState } from "./auth-form";

export interface LogoutButtonProps {
  readonly action: FormAction;
}

export function LogoutButton({ action }: LogoutButtonProps) {
  const locale = useLocale();
  const t = useTranslations();

  const [state, formAction, pending] = useActionState(
    action,
    initialFormActionState,
  );
  const errorId = useId();

  return (
    <form action={formAction} className="grid justify-items-start gap-3">
      <Button
        type="submit"
        variant="ghost"
        loading={pending}
        loadingText={t("platform.signingOutEllipsis")}
        data-leaves-page
        aria-describedby={state.error?.message ? errorId : undefined}
      >
        <LogOut aria-hidden="true" className="size-4" />
        {t("platform.signOut")}
      </Button>
      {state.error?.message ? (
        <p
          id={errorId}
          className="border-destructive/40 bg-destructive-subtle text-destructive rounded-md border p-3 text-sm leading-6"
          role="alert"
        >
          {actionMessage(locale, state.error.message, state.error.code)}
        </p>
      ) : null}
    </form>
  );
}
