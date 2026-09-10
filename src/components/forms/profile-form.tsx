"use client";

import {
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";

import type { FormAction, FormFieldErrors } from "./auth-form";
import { initialFormActionState } from "./auth-form";
import { useUnsavedChangesWarning } from "./use-unsaved-changes-warning";

export interface ProfileFormUser {
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly bio?: string | null;
}

export interface ProfileFormProps {
  readonly action: FormAction;
  readonly user: ProfileFormUser;
}

function firstFieldError(
  fieldErrors: FormFieldErrors | undefined,
  field: string,
): string | undefined {
  if (!fieldErrors || typeof fieldErrors !== "object") return undefined;
  const value = fieldErrors[field];
  return value?.[0];
}

function initials(displayName: string, username: string): string {
  const source = displayName.trim() || username.trim() || "TP";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0] ?? "")
    .join("")
    .toUpperCase();
}

export function ProfileForm({ action, user }: ProfileFormProps) {
  const [dirty, setDirty] = useState(false);
  const [draft, setDraft] = useState({
    username: user.username,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? "",
    bio: user.bio ?? "",
  });
  const formRef = useRef<HTMLFormElement>(null);
  const submitProfile = useCallback<FormAction>(
    async (previousState, formData) => {
      const result = await action(previousState, formData);
      if (result.ok) setDirty(false);
      return result;
    },
    [action],
  );
  const [state, formAction, pending] = useActionState(
    submitProfile,
    initialFormActionState,
  );
  const errors = state.error?.fieldErrors;
  const bioError = firstFieldError(errors, "bio");

  useUnsavedChangesWarning(dirty);

  useEffect(() => {
    if (errors) {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    }
  }, [errors]);

  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle as="h2">Profile details</CardTitle>
        <CardDescription>
          Keep the identity your teammates will recognize. You can change these
          details later.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-5"
          noValidate
        >
          <div className="border-border bg-muted/50 flex items-center gap-4 rounded-md border p-4">
            <Avatar size="lg">
              {draft.avatarUrl ? (
                <AvatarImage
                  src={draft.avatarUrl}
                  alt={`${draft.displayName || draft.username} avatar`}
                />
              ) : null}
              <AvatarFallback
                role="img"
                aria-label={`${draft.displayName || draft.username} initials avatar`}
              >
                {initials(draft.displayName, draft.username)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-foreground truncate font-semibold">
                {draft.displayName || draft.username}
              </p>
              <p className="text-muted-foreground truncate text-sm">
                @{draft.username}
              </p>
              <p className="text-muted-foreground mt-1 text-xs">
                Use a stable image URL or leave blank for initials.
              </p>
            </div>
          </div>

          <Input
            autoComplete="username"
            required
            disabled={pending}
            label="Username"
            name="username"
            value={draft.username}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                username: event.target.value,
              }));
              setDirty(true);
            }}
            minLength={3}
            maxLength={32}
            {...(firstFieldError(errors, "username")
              ? { error: firstFieldError(errors, "username") }
              : {})}
            description="3–32 characters: letters, numbers, and underscores."
          />

          <Input
            autoComplete="name"
            required
            disabled={pending}
            label="Display name"
            name="displayName"
            value={draft.displayName}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                displayName: event.target.value,
              }));
              setDirty(true);
            }}
            maxLength={64}
            {...(firstFieldError(errors, "displayName")
              ? { error: firstFieldError(errors, "displayName") }
              : {})}
          />

          <Input
            label="Avatar URL"
            disabled={pending}
            name="avatarUrl"
            type="url"
            inputMode="url"
            value={draft.avatarUrl}
            onChange={(event) => {
              setDraft((current) => ({
                ...current,
                avatarUrl: event.target.value,
              }));
              setDirty(true);
            }}
            {...(firstFieldError(errors, "avatarUrl")
              ? { error: firstFieldError(errors, "avatarUrl") }
              : {})}
            description="Optional. For best results use a square image hosted over HTTPS."
          />

          <div className="grid gap-2">
            <label
              className="text-foreground text-sm font-semibold"
              htmlFor="profile-bio"
            >
              Short bio{" "}
              <span className="text-muted-foreground font-normal">
                (optional)
              </span>
            </label>
            <textarea
              id="profile-bio"
              name="bio"
              value={draft.bio}
              onChange={(event) => {
                setDraft((current) => ({
                  ...current,
                  bio: event.target.value,
                }));
                setDirty(true);
              }}
              maxLength={280}
              rows={4}
              disabled={pending}
              className="border-border-strong bg-surface-interactive text-foreground placeholder:text-muted-foreground/75 hover:border-primary/65 focus-visible:border-primary focus-visible:ring-ring focus-visible:ring-offset-background w-full resize-y rounded-md border px-3 py-3 text-base transition-[background-color,border-color,box-shadow] duration-200 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              aria-describedby={`profile-bio-help${bioError ? " profile-bio-error" : ""}`}
              aria-errormessage={bioError ? "profile-bio-error" : undefined}
              aria-invalid={bioError ? true : undefined}
            />
            <p id="profile-bio-help" className="text-muted-foreground text-sm">
              A short introduction, up to 280 characters.
            </p>
            {bioError ? (
              <p
                id="profile-bio-error"
                className="text-destructive text-sm"
                role="alert"
              >
                {bioError}
              </p>
            ) : null}
          </div>

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

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="submit"
              loading={pending}
              loadingText="Saving profile…"
            >
              Save profile
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
