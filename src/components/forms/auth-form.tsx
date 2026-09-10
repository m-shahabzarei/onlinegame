"use client";
import { actionMessage, localizedFieldErrors } from "@/i18n/action-messages";
import { useLocale } from "@/i18n/provider";
import { createTranslator } from "@/i18n/client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Locale } from "@/i18n/messages";

import { ArrowRight, Check, UserRound } from "lucide-react";

import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from "@/components/ui";

export interface FormFieldErrors {
  readonly [field: string]: readonly string[] | undefined;
}

export interface ActionError {
  readonly code?: string;
  readonly message: string;
  readonly fieldErrors?: FormFieldErrors;
}

export interface FormActionState {
  readonly ok: boolean;
  readonly message?: string;
  readonly error?: ActionError;
  readonly data?: {
    readonly redirectTo?: string;
    readonly [key: string]: unknown;
  };
}

export type FormAction = (
  previousState: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;

export const initialFormActionState: FormActionState = { ok: false };

export interface AuthFormProps {
  readonly action: FormAction;
  readonly mode: "login" | "register";
  readonly nextPath?: string | undefined;
  readonly locale?: Locale;
}

export interface GuestFormProps {
  readonly action: FormAction;
  readonly nextPath?: string | undefined;
  readonly locale?: Locale;
}

function firstFieldError(
  fieldErrors: FormFieldErrors | undefined,
  field: string,
): string | undefined {
  const messages = fieldErrors?.[field];
  return messages?.[0];
}

/**
 * Shared login and registration form. The action is supplied by the server
 * boundary so credentials never need to cross into a client-side service.
 */
export function AuthForm({
  action,
  mode,
  nextPath,
  locale: explicitLocale,
}: AuthFormProps) {
  const contextLocale = useLocale();
  const locale = explicitLocale ?? contextLocale;
  const t = createTranslator(locale);

  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [values, setValues] = useState({
    username: "",
    email: "",
    identifier: "",
    displayName: "",
    password: "",
    passwordConfirmation: "",
    remember: true,
  });
  const [state, formAction, pending] = useActionState(
    action,
    initialFormActionState,
  );
  const fieldErrors = localizedFieldErrors(locale, state.error?.fieldErrors);
  const isRegister = mode === "register";

  useEffect(() => {
    const destination = state.ok ? state.data?.redirectTo : undefined;
    if (destination) {
      router.replace(destination as Parameters<typeof router.replace>[0]);
    }
  }, [router, state]);

  useEffect(() => {
    if (state.error?.fieldErrors) {
      formRef.current
        ?.querySelector<HTMLElement>("[aria-invalid='true']")
        ?.focus();
    }
  }, [state.error?.fieldErrors]);

  return (
    <Card className="mx-auto w-full max-w-lg" variant="elevated">
      <CardHeader className="space-y-3">
        <p className="text-primary font-mono text-xs font-semibold tracking-[0.2em] uppercase">
          {isRegister ? t("auth.newOperator") : t("auth.secureAccess")}
        </p>
        <CardTitle as="h1" className="text-2xl sm:text-3xl">
          {isRegister ? t("auth.createTitle") : t("auth.welcomeBack")}
        </CardTitle>
        <CardDescription>
          {isRegister ? t("auth.registerIntro") : t("auth.loginIntro")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-5"
          noValidate
        >
          {nextPath ? (
            <input type="hidden" name="next" value={nextPath} />
          ) : null}

          {isRegister ? (
            <Input
              autoComplete="username"
              required
              disabled={pending}
              label={t("auth.username")}
              name="username"
              dir="ltr"
              value={values.username}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  username: event.target.value,
                }))
              }
              minLength={3}
              maxLength={32}
              {...(firstFieldError(fieldErrors, "username")
                ? { error: firstFieldError(fieldErrors, "username") }
                : {})}
              description={t("auth.usernameHelp")}
            />
          ) : null}

          <Input
            autoComplete="email"
            required
            disabled={pending}
            label={isRegister ? t("auth.email") : t("auth.emailOrUsername")}
            name={isRegister ? "email" : "identifier"}
            dir="ltr"
            type={isRegister ? "email" : "text"}
            inputMode={isRegister ? "email" : "text"}
            value={isRegister ? values.email : values.identifier}
            onChange={(event) => {
              const value = event.target.value;
              setValues((current) =>
                isRegister
                  ? { ...current, email: value }
                  : { ...current, identifier: value },
              );
            }}
            {...((firstFieldError(fieldErrors, "email") ??
            firstFieldError(fieldErrors, "identifier"))
              ? {
                  error:
                    firstFieldError(fieldErrors, "email") ??
                    firstFieldError(fieldErrors, "identifier"),
                }
              : {})}
          />

          {isRegister ? (
            <Input
              autoComplete="name"
              required
              disabled={pending}
              label={t("auth.displayName")}
              name="displayName"
              value={values.displayName}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  displayName: event.target.value,
                }))
              }
              maxLength={64}
              {...(firstFieldError(fieldErrors, "displayName")
                ? { error: firstFieldError(fieldErrors, "displayName") }
                : {})}
              description={t("auth.displayNameHelp")}
            />
          ) : null}

          <Input
            autoComplete={isRegister ? "new-password" : "current-password"}
            required
            disabled={pending}
            label={t("auth.password")}
            name="password"
            type="password"
            value={values.password}
            onChange={(event) =>
              setValues((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
            {...(isRegister ? { minLength: 8 } : {})}
            {...(firstFieldError(fieldErrors, "password")
              ? { error: firstFieldError(fieldErrors, "password") }
              : {})}
          />

          {!isRegister ? (
            <label className="text-muted-foreground flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <input
                className="focus-visible:ring-ring focus-visible:ring-offset-background size-5 accent-[var(--primary)] focus-visible:ring-2 focus-visible:ring-offset-2"
                type="checkbox"
                name="remember"
                disabled={pending}
                checked={values.remember}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    remember: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="text-foreground block font-semibold">
                  {t("auth.keepSignedIn")}
                </span>
                <span className="block text-xs">
                  {t("auth.keepSignedInHelp")}
                </span>
              </span>
            </label>
          ) : null}

          {isRegister ? (
            <Input
              autoComplete="new-password"
              required
              disabled={pending}
              label={t("auth.confirmPassword")}
              name="passwordConfirmation"
              type="password"
              value={values.passwordConfirmation}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  passwordConfirmation: event.target.value,
                }))
              }
              minLength={8}
              {...(firstFieldError(fieldErrors, "passwordConfirmation")
                ? {
                    error: firstFieldError(fieldErrors, "passwordConfirmation"),
                  }
                : {})}
            />
          ) : null}

          {state.error?.message ? (
            <p
              className="border-destructive/40 bg-destructive-subtle text-destructive rounded-md border px-3 py-2 text-sm"
              role="alert"
            >
              {actionMessage(locale, state.error.message, state.error.code)}
            </p>
          ) : null}
          {state.ok && state.message ? (
            <p
              className="border-success/40 bg-success-subtle text-success-foreground rounded-md border px-3 py-2 text-sm"
              role="status"
              aria-live="polite"
            >
              {actionMessage(locale, state.message)}
            </p>
          ) : null}

          <Button
            className="w-full"
            type="submit"
            loading={pending}
            loadingText={
              isRegister ? t("auth.creatingAccount") : t("auth.signingIn")
            }
          >
            {isRegister ? t("auth.createAccount") : t("auth.signIn")}
          </Button>
        </form>

        <div className="text-muted-foreground mt-6 grid gap-3 text-center text-sm">
          <p>
            {isRegister
              ? t("auth.alreadyHaveAccount")
              : t("auth.newToTwoPlayer")}{" "}
            <Link
              className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-1 font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              href={isRegister ? "/login" : "/register"}
            >
              {isRegister ? t("auth.signIn") : t("auth.createAnAccount")}
            </Link>
          </p>
          <p>
            <Link
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-1 underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              href="/continue-as-guest"
            >
              {t("auth.continueGuest")}
            </Link>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

/** Explicit guest continuation with clear limits before the temporary session starts. */
export function GuestForm({
  action,
  nextPath,
  locale: explicitLocale,
}: GuestFormProps) {
  const contextLocale = useLocale();
  const locale = explicitLocale ?? contextLocale;
  const t = createTranslator(locale);

  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    action,
    initialFormActionState,
  );
  useEffect(() => {
    const destination = state.ok ? state.data?.redirectTo : undefined;
    if (destination)
      router.replace(destination as Parameters<typeof router.replace>[0]);
  }, [router, state]);
  return (
    <Card className="mx-auto w-full max-w-lg" variant="elevated">
      <CardHeader className="space-y-3">
        <Badge variant="warning" className="gap-2">
          <UserRound aria-hidden="true" className="size-3.5" />
          {t("platform.temporaryAccess")}
        </Badge>
        <CardTitle as="h1" className="text-2xl sm:text-3xl">
          {t("platform.exploreGuest")}
        </CardTitle>
        <CardDescription>{t("platform.guestIntro")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid gap-5">
          {nextPath ? (
            <input type="hidden" name="next" value={nextPath} />
          ) : null}
          <ul
            className="grid gap-3"
            aria-label={t("platform.guestLimitations")}
          >
            <li className="text-muted-foreground flex items-start gap-3 text-sm leading-6">
              <Check
                aria-hidden="true"
                className="text-success mt-1 size-4 shrink-0"
              />
              {t("platform.guestBrowse")}
            </li>
            <li className="text-muted-foreground flex items-start gap-3 text-sm leading-6">
              <Check
                aria-hidden="true"
                className="text-success mt-1 size-4 shrink-0"
              />
              {t("platform.guestReview")}
            </li>
            <li className="text-muted-foreground flex items-start gap-3 text-sm leading-6">
              <ArrowRight
                aria-hidden="true"
                className="text-warning mt-1 size-4 shrink-0 rtl:rotate-180"
              />
              {t("platform.guestRooms")}
            </li>
          </ul>
          {state.error?.message ? (
            <p
              className="border-destructive/40 bg-destructive-subtle text-destructive rounded-md border px-3 py-2 text-sm"
              role="alert"
            >
              {actionMessage(locale, state.error.message, state.error.code)}
            </p>
          ) : null}
          <Button
            className="w-full"
            type="submit"
            loading={pending}
            loadingText={t("platform.startingGuest")}
            role="button"
            aria-label={t("platform.continueAsGuest")}
          >
            {t("platform.continueAsGuest")}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {t("platform.haveAccount")}{" "}
            <Link
              className="text-primary focus-visible:ring-ring inline-flex min-h-11 items-center rounded-md px-1 font-semibold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
              href="/login"
            >
              {t("platform.signInInstead")}
            </Link>
          </p>
        </form>
      </CardContent>
    </Card>
  );
}
