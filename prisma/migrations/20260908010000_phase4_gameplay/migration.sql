-- Lifecycle/lease metadata only. Movement, health and weapons remain in memory.
ALTER TABLE "Match" ADD COLUMN "gameplay" JSONB;
