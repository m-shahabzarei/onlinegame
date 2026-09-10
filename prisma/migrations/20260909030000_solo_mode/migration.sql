-- Add explicit authoritative room mode while preserving existing rooms as co-op.
CREATE TYPE "GameMode" AS ENUM ('SOLO', 'COOP');
ALTER TABLE "Room" ADD COLUMN "mode" "GameMode" NOT NULL DEFAULT 'COOP';
