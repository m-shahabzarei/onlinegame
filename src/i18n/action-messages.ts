import { clientTranslate } from "./client";
import { platformMessages } from "./platform-messages";
import type { Locale } from "./messages";

const actionKeys = [
  "actionUnavailable",
  "accountReady",
  "signedIn",
  "guestStarted",
  "logoutFailure",
  "profileSaved",
  "signInProfile",
  "profileSaveFailure",
  "signInPreferences",
  "preferencesSaved",
  "preferencesFailure",
  "invalidInput",
  "invalidCredentials",
  "accountExists",
  "usernameTaken",
  "signInRequired",
  "sessionExpired",
  "invalidField",
  "emailInvalid",
  "emailLong",
  "passwordShort",
  "passwordLong",
  "displayNameRequired",
  "displayNameLong",
  "passwordMismatch",
  "identifierRequired",
  "avatarInvalid",
  "avatarProtocol",
  "avatarLong",
  "bioLong",
  "usernameShort",
  "usernameLong",
  "usernameInvalid",
] as const;
export type ActionMessageCode = (typeof actionKeys)[number];
const errorCodes: Readonly<Record<string, ActionMessageCode>> = {
  INVALID_INPUT: "invalidInput",
  INVALID_CREDENTIALS: "invalidCredentials",
  ACCOUNT_EXISTS: "accountExists",
  USERNAME_TAKEN: "usernameTaken",
  AUTH_UNAVAILABLE: "actionUnavailable",
  UNAUTHENTICATED: "signInRequired",
  SESSION_EXPIRED: "sessionExpired",
  SESSION_INVALID: "sessionExpired",
  USER_NOT_FOUND: "signInRequired",
  INTERNAL_ERROR: "actionUnavailable",
};

/** Compatibility adapter for the auth service: only semantic identifiers cross actions. */
export function actionMessageCode(
  message: string,
  code?: string,
): ActionMessageCode {
  const matched = actionKeys.find(
    (key) => key === message || platformMessages.en.platform[key] === message,
  );
  return matched ?? (code ? errorCodes[code] : undefined) ?? "invalidField";
}
export function actionMessage(
  locale: Locale,
  message: string,
  code?: string,
): string {
  return clientTranslate(
    locale,
    `platform.${actionMessageCode(message, code)}`,
  );
}
export function semanticFieldErrors(
  errors: Readonly<Record<string, readonly string[] | undefined>>,
) {
  return Object.fromEntries(
    Object.entries(errors).map(([field, values]) => [
      field,
      values?.map((value) => actionMessageCode(value)),
    ]),
  );
}
export function localizedFieldErrors(
  locale: Locale,
  errors: Readonly<Record<string, readonly string[] | undefined>> | undefined,
) {
  if (!errors) return undefined;
  return Object.fromEntries(
    Object.entries(errors).map(([field, values]) => [
      field,
      values?.map((value) => actionMessage(locale, value)),
    ]),
  );
}
