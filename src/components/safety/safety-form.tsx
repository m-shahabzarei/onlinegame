"use client";
import { FormEvent, useState } from "react";
import { Button, Input, Select } from "@/components/ui";

export function SafetyForm() {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [blockMessage, setBlockMessage] = useState<string | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "report",
        targetUserId: form.get("targetUserId"),
        reason: form.get("reason"),
        details: form.get("details") || undefined,
      }),
    });
    const body = await response.json().catch(() => null);
    setMessage(
      body?.ok
        ? "Report submitted. Thank you for helping keep sessions safe."
        : body?.code === "RATE_LIMITED"
          ? "You have reached the report limit for this player today."
          : "We could not submit that report. Check the identifier and try again.",
    );
    setPending(false);
  }
  async function block(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUserId = new FormData(event.currentTarget).get("targetUserId");
    const response = await fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "block", targetUserId, blocked: true }),
    });
    setBlockMessage(
      response.ok
        ? "Player blocked for future supported communication channels."
        : "We could not update the block list.",
    );
  }
  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={submit}>
        <Input
          label="Player identifier"
          name="targetUserId"
          required
          maxLength={128}
          description="Use the identifier shown by the match or support flow."
        />
        <Select
          label="Reason"
          name="reason"
          options={[
            { value: "ABUSE", label: "Abuse" },
            { value: "CHEATING", label: "Cheating" },
            { value: "HARASSMENT", label: "Harassment" },
            { value: "EXPLOIT", label: "Exploit" },
            { value: "OTHER", label: "Other" },
          ]}
        />
        <label className="grid gap-2">
          <span className="text-foreground text-sm font-semibold">
            Details{" "}
            <span className="text-muted-foreground font-normal">
              (optional)
            </span>
          </span>
          <textarea
            name="details"
            maxLength={500}
            rows={4}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            placeholder="What happened?"
          />
        </label>
        {message ? (
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {message}
          </p>
        ) : null}
        <Button type="submit" loading={pending} loadingText="Submitting…">
          Submit report
        </Button>
      </form>
      <form onSubmit={block} className="flex flex-wrap items-center gap-3">
        <Input
          label="Player identifier to block"
          name="targetUserId"
          required
          maxLength={128}
        />
        <Button type="submit" variant="outline">
          Block player
        </Button>
        {blockMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {blockMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}
