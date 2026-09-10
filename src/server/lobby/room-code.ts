import "server-only";
import { randomInt } from "node:crypto";
import { ROOM_CODE_ALPHABET } from "@/domain/lobby";
export function generateRoomCode(): string {
  return Array.from(
    { length: 8 },
    () => ROOM_CODE_ALPHABET[randomInt(ROOM_CODE_ALPHABET.length)],
  ).join("");
}
