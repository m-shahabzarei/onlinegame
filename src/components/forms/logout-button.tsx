"use client";

import { LogOut } from "lucide-react";
import { useActionState, useId } from "react";

import { Button } from "@/components/ui";

import type { FormAction } from "./auth-form";
import { initialFormActionState } from "./auth-form";

export interface LogoutButtonProps {
  readonly action: FormAction;
}

export function LogoutButton({ action }: LogoutButtonProps) {
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
        loadingText="Signing out…"
        data-leaves-page
        aria-describedby={state.error?.message ? errorId : undefined}
      >
        <LogOut aria-hidden="true" className="size-4" />
        Sign out
      </Button>
      {state.error?.message ? (
        <p
          id={errorId}
          className="border-destructive/40 bg-destructive-subtle text-destructive rounded-md border p-3 text-sm leading-6"
          role="alert"
        >
          {state.error.message}
        </p>
      ) : null}
    </form>
  );
}
