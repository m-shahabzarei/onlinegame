import { z } from "zod";

import { usernameSchema } from "./user";

const nullableText = (max: number, label: string) =>
  z.preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .max(max, `${label} must contain at most ${max} characters.`)
      .nullable(),
  );

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Display name is required.")
  .max(64, "Display name must contain at most 64 characters.");

export const avatarUrlSchema = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") return value;
      const trimmed = value.trim();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .url("Avatar must be a valid URL.")
      .refine((value) => {
        try {
          return ["http:", "https:"].includes(new URL(value).protocol);
        } catch {
          return false;
        }
      }, "Avatar URL must use HTTP or HTTPS.")
      .max(2_048, "Avatar URL is too long.")
      .nullable(),
  )
  .optional();

export const supportedLocaleSchema = z.enum(["en", "fa"]);

const optionalLocaleSchema = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}, supportedLocaleSchema.nullable());

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
  avatarUrl: avatarUrlSchema,
  bio: nullableText(280, "Bio").optional(),
});

export const settingsUpdateSchema = z.object({
  displayName: displayNameSchema.optional(),
  avatarUrl: avatarUrlSchema,
  locale: optionalLocaleSchema.optional(),
  reducedMotion: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
});

export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
