import { z } from "zod";
export const settingsSchema = z
  .object({
    sensitivity: z.number().min(0.2).max(3),
    invertY: z.boolean(),
    fov: z.number().min(65).max(105),
    volume: z.number().min(0).max(1),
    reducedMotion: z.boolean(),
    cameraShake: z.boolean(),
    screenFlashes: z.boolean(),
  })
  .strict();
export type GameSettings = z.infer<typeof settingsSchema>;
export const DEFAULT_SETTINGS: GameSettings = {
  sensitivity: 1,
  invertY: false,
  fov: 80,
  volume: 0.4,
  reducedMotion: false,
  cameraShake: true,
  screenFlashes: true,
};
export const SETTINGS_KEY = "twoplayer.game.settings.v1";
export function loadSettings(
  account: { reducedMotion: boolean; soundEnabled: boolean },
  storage: Pick<Storage, "getItem">,
  systemReduced: boolean,
): GameSettings {
  const defaults = {
    ...DEFAULT_SETTINGS,
    reducedMotion: account.reducedMotion || systemReduced,
    volume: account.soundEnabled ? DEFAULT_SETTINGS.volume : 0,
  };
  try {
    const parsed = settingsSchema.safeParse(
      JSON.parse(storage.getItem(SETTINGS_KEY) ?? "null"),
    );
    return parsed.success
      ? {
          ...parsed.data,
          reducedMotion: parsed.data.reducedMotion || systemReduced,
        }
      : defaults;
  } catch {
    return defaults;
  }
}
