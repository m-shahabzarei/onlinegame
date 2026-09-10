import {
  messages,
  type Locale,
  type TranslationKey,
  type TranslationValue,
} from "./messages";

export const LOCALE_COOKIE = "twoplayer_locale";
export const localeDirection = { en: "ltr", fa: "rtl" } as const;
export const alternateLocale = { en: "fa", fa: "en" } as const;
export function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "fa";
}
export function resolveLocale(
  explicit?: unknown,
  preferred?: unknown,
  cookie?: unknown,
): Locale {
  return isLocale(explicit)
    ? explicit
    : isLocale(preferred)
      ? preferred
      : isLocale(cookie)
        ? cookie
        : "en";
}

type Placeholders<S> = S extends string
  ? S extends `${string}{${infer Name}}${infer Rest}`
    ? Name | Placeholders<Rest>
    : never
  : S extends { readonly one: infer One; readonly other: infer Other }
    ? "count" | Placeholders<One> | Placeholders<Other>
    : never;
export type TranslationArgs<K extends TranslationKey> = [
  Placeholders<TranslationValue<K>>,
] extends [never]
  ? [params?: Record<string, string | number>]
  : [
      params: {
        [P in Placeholders<TranslationValue<K>>]: P extends "count"
          ? number
          : string | number;
      },
    ];

const numberFormats = new Map<string, Intl.NumberFormat>();
const dateFormats = new Map<string, Intl.DateTimeFormat>();
const pluralRules = {
  en: new Intl.PluralRules("en"),
  fa: new Intl.PluralRules("fa"),
};

export function formatNumber(
  locale: Locale,
  value: number,
  options?: Intl.NumberFormatOptions,
): string {
  const key = `${locale}:${JSON.stringify(options ?? {})}`;
  let formatter = numberFormats.get(key);
  if (!formatter) {
    if (numberFormats.size >= 32) numberFormats.clear();
    formatter = new Intl.NumberFormat(locale, options);
    numberFormats.set(key, formatter);
  }
  return formatter.format(value);
}
export function formatDate(
  locale: Locale,
  value: Date | number | string,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
): string {
  const key = `${locale}:${JSON.stringify(options)}`;
  let formatter = dateFormats.get(key);
  if (!formatter) {
    if (dateFormats.size >= 32) dateFormats.clear();
    formatter = new Intl.DateTimeFormat(locale, {
      timeZone: "UTC",
      ...options,
    });
    dateFormats.set(key, formatter);
  }
  return formatter.format(new Date(value));
}

/** One strict translation implementation shared by server and client. */
export function translate<K extends TranslationKey>(
  locale: Locale,
  key: K,
  ...args: TranslationArgs<K>
): string {
  let value: unknown = messages[locale];
  for (const part of key.split("."))
    value =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)[part]
        : undefined;
  const params = args[0] as Record<string, string | number> | undefined;
  if (value && typeof value === "object" && "other" in value) {
    const count = params?.count;
    if (typeof count !== "number") throw new Error(`I18N_PLURAL_COUNT:${key}`);
    const rule = pluralRules[locale].select(count);
    value =
      (value as Record<string, string>)[rule] ??
      (value as Record<string, string>).other;
  }
  if (typeof value !== "string")
    throw new Error(`I18N_MISSING_KEY:${locale}:${key}`);
  return value.replace(/\{([A-Za-z][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const param = params?.[name];
    if (param === undefined)
      throw new Error(`I18N_MISSING_PARAMETER:${key}:${name}`);
    return typeof param === "number" ? formatNumber(locale, param) : param;
  });
}
export function createTranslator(locale: Locale) {
  return <K extends TranslationKey>(key: K, ...args: TranslationArgs<K>) =>
    translate(locale, key, ...args);
}
