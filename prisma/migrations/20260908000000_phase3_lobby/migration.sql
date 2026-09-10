-- Additive migration against the existing Phase 2 schema. No rows are deleted.
ALTER TABLE "Room" ADD COLUMN "stateVersion" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "creationKey" VARCHAR(64),
  ADD COLUMN "commandReceipts" JSONB NOT NULL DEFAULT '[]';
CREATE UNIQUE INDEX "Room_creationKey_key" ON "Room"("creationKey");
ALTER TABLE "RoomMember" ADD COLUMN "removedAt" TIMESTAMP(3),
  ADD COLUMN "removalReason" VARCHAR(16);
CREATE INDEX "Room_gameId_visibility_status_createdAt_idx" ON "Room"("gameId", "visibility", "status", "createdAt");
