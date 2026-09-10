import { messages, type Locale, type TranslationKey } from "./messages";
export function clientTranslate(locale: Locale, key: TranslationKey): string {
  const [group, leaf] = key.split(".") as [keyof typeof messages.en, string];
  const value = (messages[locale][group] as Record<string, string>)[leaf];
  return value ?? (messages.en[group] as Record<string, string>)[leaf] ?? key;
}
