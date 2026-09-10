import { z } from "zod";
export const gameModeSchema = z.enum(["solo", "coop"]);
export type GameMode = z.infer<typeof gameModeSchema>;
