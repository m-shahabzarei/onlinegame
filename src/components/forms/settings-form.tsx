"use client";

import { useActionState, useCallback, useState } from "react";

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
} from "@/components/ui";

import type { FormAction } from "./auth-form";
import { initialFormActionState } from "./auth-form";
import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";
import { clientTranslate } from "@/i18n/client";
import type { Locale } from "@/i18n/messages";

export interface SettingsFormValues {
  readonly locale?: string | null;
  readonly reducedMotion: boolean;
  readonly soundEnabled: boolean;
}

export interface SettingsFormProps {
  readonly action: FormAction;
  readonly values: SettingsFormValues;
}

export function SettingsForm({ action, values }: SettingsFormProps) {
  const [dirty, setDirty] = useState(false);
  const locale = (values.locale === "fa" ? "fa" : "en") as Locale;
  const copy = {
    language: clientTranslate(locale, "navigation.language"),
    motion: clientTranslate(locale, "settings.motion"),
    reduceMotion: clientTranslate(locale, "settings.reduceMotion"),
    reduceMotionHelp: clientTranslate(locale, "settings.reduceMotionHelp"),
    audio: clientTranslate(locale, "settings.audio"),
    sound: clientTranslate(locale, "settings.sound"),
    soundHelp: clientTranslate(locale, "settings.soundHelp"),
    save: clientTranslate(locale, "settings.save"),
    saving: clientTranslate(locale, "settings.saving"),
  };
  const [draft, setDraft] = useState({
    locale: values.locale ?? "en",
    reducedMotion: values.reducedMotion,
    soundEnabled: values.soundEnabled,
  });
  const submitSettings = useCallback<FormAction>(
    async (previousState, formData) => {
      const result = await action(previousState, formData);
      if (result.ok) setDirty(false);
      return result;
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(
    submitSettings,
    initialFormActionState,
  );

  useUnsavedChangesWarning(dirty);

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle as="h2">Preferences</CardTitle>
        <CardDescription>
          Tune the platform to your setup. These preferences apply to your
          account on supported devices.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-6" noValidate>
          <Select
            label={copy.language}
            name="locale"
            disabled={pending}
            value={draft.locale}
            onValueChange={(locale) => {
              setDraft((current) => ({ ...current, locale }));
              setDirty(true);
            }}
            options={[
              { value: "en", label: "English" },
              { value: "fa", label: "فارسی (Persian)" },
            ]}
            description="More languages will be added as localization expands."
          />

          <fieldset className="grid gap-3">
            <legend className="text-foreground text-sm font-semibold">
              {copy.motion}
            </legend>
            <label className="border-border bg-muted/50 hover:border-primary/60 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 transition-colors duration-200">
              <span>
                <span className="text-foreground block text-sm font-semibold">
                  {copy.reduceMotion}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {copy.reduceMotionHelp}
                </span>
              </span>
              <input
                className="focus-visible:ring-ring focus-visible:ring-offset-background size-5 accent-[var(--primary)] focus-visible:ring-2 focus-visible:ring-offset-2"
                type="checkbox"
                name="reducedMotion"
                disabled={pending}
                checked={draft.reducedMotion}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    reducedMotion: event.target.checked,
                  }));
                  setDirty(true);
                }}
              />
            </label>
          </fieldset>

          <fieldset className="grid gap-3">
            <legend className="text-foreground text-sm font-semibold">
              {copy.audio}
            </legend>
            <label className="border-border bg-muted/50 hover:border-primary/60 flex min-h-14 cursor-pointer items-center justify-between gap-4 rounded-md border px-4 py-3 transition-colors duration-200">
              <span>
                <span className="text-foreground block text-sm font-semibold">
                  {copy.sound}
                </span>
                <span className="text-muted-foreground block text-sm">
                  {copy.soundHelp}
                </span>
              </span>
              <input
                className="focus-visible:ring-ring focus-visible:ring-offset-background size-5 accent-[var(--primary)] focus-visible:ring-2 focus-visible:ring-offset-2"
                type="checkbox"
                name="soundEnabled"
                disabled={pending}
                checked={draft.soundEnabled}
                onChange={(event) => {
                  setDraft((current) => ({
                    ...current,
                    soundEnabled: event.target.checked,
                  }));
                  setDirty(true);
                }}
              />
            </label>
          </fieldset>

          {state.error?.message ? (
            <p
              className="border-destructive/40 bg-destructive-subtle text-destructive rounded-md border px-3 py-2 text-sm"
              role="alert"
            >
              {state.error.message}
            </p>
          ) : null}
          {state.ok && state.message ? (
            <p
              className="border-success/40 bg-success-subtle text-success-foreground rounded-md border px-3 py-2 text-sm"
              role="status"
              aria-live="polite"
            >
              {state.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" loading={pending} loadingText={copy.saving}>
              {copy.save}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
