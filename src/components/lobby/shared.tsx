"use client";
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

const labels: Record<ConnectionState, string> = {
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  RECONNECTING: "Reconnecting",
  DISCONNECTED: "Disconnected",
  FAILED: "Connection failed",
};
export function ConnectionBanner({
  state,
  retry,
}: {
  state: ConnectionState;
  retry(): void;
}) {
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
            · Actions resume after recovery.
          </span>
        )}
      </span>
      {state !== "CONNECTED" && (
        <Button size="sm" variant="outline" onClick={retry}>
          <RotateCcw aria-hidden="true" className="size-4" />
          Retry connection
        </Button>
      )}
    </div>
  );
}
export function SessionRequired({ next }: { next: string }) {
  return (
    <Card padding="lg" className="mx-auto max-w-xl space-y-5">
      <h1 className="font-display text-2xl">Choose your player identity</h1>
      <p className="text-muted-foreground">
        Sign in or use a guest session to create and join rooms. Your invite
        will be kept.
      </p>
      <div className="flex flex-wrap gap-3">
        <Link
          className={buttonVariants()}
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          Sign in
        </Link>
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`/continue-as-guest?next=${encodeURIComponent(next)}`}
        >
          Continue as guest
        </Link>
        <Link className={buttonVariants({ variant: "ghost" })} href="/games">
          Back to games
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
          <DialogTitle>{label}?</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline" disabled={pending} autoFocus>
              Keep room
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
  const [feedback, setFeedback] = useState("");
  const field = useRef<HTMLInputElement>(null);
  async function copy(link: boolean) {
    const value = link ? `${window.location.origin}/rooms/${code}` : code;
    try {
      await navigator.clipboard.writeText(value);
      setFeedback(link ? "Invite link copied." : "Room code copied.");
    } catch {
      if (field.current) {
        field.current.value = value;
        field.current.focus();
        field.current.select();
      }
      setFeedback(
        "Copy is unavailable. The invite is selected below; use your device’s Copy action.",
      );
    }
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={() => void copy(false)}>
          <Copy aria-hidden="true" className="size-4" />
          Copy code
        </Button>
        <Button variant="outline" size="sm" onClick={() => void copy(true)}>
          <Link2 aria-hidden="true" className="size-4" />
          Copy invite link
        </Button>
      </div>
      <Input
        ref={field}
        label="Shareable invite"
        readOnly
        defaultValue={`/rooms/${code}`}
        className="font-mono text-sm"
      />
      <p
        role="status"
        aria-live="polite"
        className="text-muted-foreground min-h-5 text-sm"
      >
        {feedback}
      </p>
    </div>
  );
}
