"use client";
import { useTranslations } from "@/i18n/provider";

import { FormEvent, useState } from "react";
import { Button, Input, Select } from "@/components/ui";

export function SafetyForm() {
  const t = useTranslations();

  const [message, setMessage] = useState<
    "reportSubmitted" | "reportLimited" | "reportFailure" | null
  >(null);
  const [pending, setPending] = useState(false);
  const [blockMessage, setBlockMessage] = useState<
    "playerBlocked" | "blockFailure" | null
  >(null);
  const [blocking, setBlocking] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    try {
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
          ? "reportSubmitted"
          : body?.code === "RATE_LIMITED"
            ? "reportLimited"
            : "reportFailure",
      );
    } catch {
      setMessage("reportFailure");
    } finally {
      setPending(false);
    }
  }
  async function block(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const targetUserId = new FormData(event.currentTarget).get("targetUserId");
    setBlocking(true);
    setBlockMessage(null);
    try {
      const response = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "block", targetUserId, blocked: true }),
      });
      setBlockMessage(response.ok ? "playerBlocked" : "blockFailure");
    } catch {
      setBlockMessage("blockFailure");
    } finally {
      setBlocking(false);
    }
  }
  return (
    <div className="grid gap-5">
      <form className="grid gap-5" onSubmit={submit}>
        <Input
          label={t("platform.playerId")}
          name="targetUserId"
          dir="ltr"
          required
          maxLength={128}
          description={t("platform.playerIdHelp")}
        />
        <Select
          label={t("platform.reportReason")}
          name="reason"
          options={[
            { value: "ABUSE", label: t("platform.abuse") },
            { value: "CHEATING", label: t("platform.cheating") },
            { value: "HARASSMENT", label: t("platform.harassment") },
            { value: "EXPLOIT", label: t("platform.exploit") },
            { value: "OTHER", label: t("platform.other") },
          ]}
        />
        <label className="grid gap-2">
          <span className="text-foreground text-sm font-semibold">
            {t("platform.details")}{" "}
            <span className="text-muted-foreground font-normal">
              {t("platform.optional")}
            </span>
          </span>
          <textarea
            name="details"
            maxLength={500}
            rows={4}
            className="border-border bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none"
            placeholder={t("platform.whatHappened")}
          />
        </label>
        {message ? (
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {t(`platform.${message}`)}
          </p>
        ) : null}
        <Button
          type="submit"
          loading={pending}
          loadingText={t("platform.submitting")}
        >
          {t("platform.submitReport")}
        </Button>
      </form>
      <form onSubmit={block} className="flex flex-wrap items-center gap-3">
        <Input
          label={t("platform.blockPlayerId")}
          name="targetUserId"
          dir="ltr"
          required
          maxLength={128}
        />
        <Button type="submit" variant="outline" loading={blocking}>
          {t("platform.blockPlayer")}
        </Button>
        {blockMessage ? (
          <p
            role="status"
            aria-live="polite"
            className="text-muted-foreground text-sm"
          >
            {t(`platform.${blockMessage}`)}
          </p>
        ) : null}
      </form>
    </div>
  );
}
