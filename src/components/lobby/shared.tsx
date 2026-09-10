"use client";
import { useLocale, useTranslations } from "@/i18n/provider";
import { createTranslator } from "@/i18n/client";

import Link from "next/link";
import { Copy, Link2, Radio, RotateCcw } from "lucide-react";
import { useRef, useState } from "react";
import type { ConnectionState } from "@/realtime/contracts";
import {
  Button,
  buttonVariants,
  Card,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@/components/ui";

export function ConnectionBanner({
  state,
  retry,
}: {
  state: ConnectionState;
  retry(): void;
}) {
  const t = useTranslations();

  const labels: Record<ConnectionState, string> = {
    CONNECTING: t("platform.connecting"),
    CONNECTED: t("platform.connected"),
    RECONNECTING: t("platform.reconnecting"),
    DISCONNECTED: t("platform.disconnected"),
    FAILED: t("platform.connectionFailed"),
  };

  return (
    <div
      className="border-border bg-surface/90 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <span className="flex items-center gap-2 text-sm">
        <Radio className="text-primary size-4" aria-hidden="true" />
        {labels[state]}
        {state !== "CONNECTED" && (
          <span className="text-muted-foreground">
            {" "}
            {t("platform.actionsResume")}
          </span>
        )}
      </span>
      {state !== "CONNECTED" && (
        <Button size="sm" variant="outline" onClick={retry}>
          <RotateCcw aria-hidden="true" className="size-4" />
          {t("platform.retryConnection")}
        </Button>
      )}
    </div>
  );
}
export function SessionRequired({ next }: { next: string }) {
  const locale = useLocale();
  const t = createTranslator(locale);

  return (
    <Card padding="lg" className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-2xl">{t("platform.chooseIdentity")}</h1>
      <p className="text-muted-foreground">{t("platform.identityHelp")}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          className={buttonVariants()}
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          {t("platform.signIn")}
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/continue-as-guest?next=${encodeURIComponent(next)}`}
        >
          {t("platform.continueGuest")}
        </Link>
        <Link className={buttonVariants({ variant: "ghost" })} href="/games">
          {t("platform.backGames")}
        </Link>
      </div>
    </Card>
  );
}
export function ConfirmAction({
  label,
  description,
  disabled,
  onConfirm,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onConfirm(): Promise<void>;
}) {
  const locale = useLocale();
  const t = createTranslator(locale);

  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled}>
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent
        onEscapeKeyDown={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>{t("platform.confirmTitle", { label })}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending} autoFocus>
              {t("platform.keepRoom")}
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            loading={pending}
            onClick={async () => {
              setPending(true);
              try {
                await onConfirm();
                setOpen(false);
              } finally {
                setPending(false);
              }
            }}
          >
            {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export function InviteControls({ code }: { code: string }) {
  const locale = useLocale();
  const t = createTranslator(locale);

  const [feedback, setFeedback] = useState<
    "inviteCopied" | "codeCopied" | "copyUnavailable" | null
  >(null);
  const field = useRef<HTMLInputElement>(null);
  async function copy(link: boolean) {
    const value = link ? `${window.location.origin}/rooms/${code}` : code;
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(link ? "inviteCopied" : "codeCopied");
    } catch {
      if (field.current) {
        field.current.value = value;
        field.current.focus();
        field.current.select();
      }
      setFeedback("copyUnavailable");
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={() => void copy(false)}>
          <Copy aria-hidden="true" className="size-4" />
          {t("platform.copyCode")}
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copy(true)}>
          <Link2 aria-hidden="true" className="size-4" />
          {t("platform.copyInvite")}
        </Button>
      </div>
      <Input
        ref={field}
        label={t("platform.shareableInvite")}
        dir="ltr"
        readOnly
        defaultValue={`/rooms/${code}`}
        className="font-mono text-sm"
      />
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground min-h-5 text-sm"
      >
        {feedback && t(`platform.${feedback}`)}
      </p>
    </div>
  );
}
