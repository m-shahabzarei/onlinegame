-- Phase 8 release foundation: bounded history, challenges, cosmetics and safety.
ALTER TABLE "User" ADD COLUMN "analyticsOptOut" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "onboardingVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "onboardingCompletedAt" TIMESTAMP(3);

CREATE TYPE "ChallengeCadence" AS ENUM ('DAILY', 'WEEKLY');
CREATE TYPE "CosmeticKind" AS ENUM ('AVATAR_FRAME', 'BADGE', 'BANNER', 'TITLE', 'EMOTE', 'WEAPON_APPEARANCE', 'MENU_THEME', 'LOBBY_EFFECT');
CREATE TYPE "ReportReason" AS ENUM ('ABUSE', 'CHEATING', 'HARASSMENT', 'EXPLOIT', 'OTHER');

CREATE TABLE "MatchHistory" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "result" VARCHAR(16) NOT NULL,
  "completedWaves" INTEGER NOT NULL DEFAULT 0,
  "score" INTEGER NOT NULL DEFAULT 0,
  "contribution" INTEGER NOT NULL DEFAULT 0,
  "kills" INTEGER NOT NULL DEFAULT 0,
  "damage" INTEGER NOT NULL DEFAULT 0,
  "revives" INTEGER NOT NULL DEFAULT 0,
  "objectives" INTEGER NOT NULL DEFAULT 0,
  "durationSeconds" INTEGER NOT NULL DEFAULT 0,
  "reconnected" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchHistory_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "MatchHistory_matchId_userId_key" ON "MatchHistory"("matchId", "userId");
CREATE INDEX "MatchHistory_userId_createdAt_idx" ON "MatchHistory"("userId", "createdAt");
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchHistory" ADD CONSTRAINT "MatchHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ChallengeDefinition" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "cadence" "ChallengeCadence" NOT NULL,
  "target" INTEGER NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "rewardCosmeticId" TEXT,
  "displayCopy" VARCHAR(180) NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "ChallengeDefinition_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChallengeDefinition_cadence_startsAt_endsAt_idx" ON "ChallengeDefinition"("cadence", "startsAt", "endsAt");

CREATE TABLE "ChallengeProgress" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completedAt" TIMESTAMP(3),
  "rewardGrantedAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChallengeProgress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ChallengeProgress_challengeId_userId_key" ON "ChallengeProgress"("challengeId", "userId");
CREATE INDEX "ChallengeProgress_userId_updatedAt_idx" ON "ChallengeProgress"("userId", "updatedAt");
ALTER TABLE "ChallengeProgress" ADD CONSTRAINT "ChallengeProgress_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "ChallengeDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChallengeProgress" ADD CONSTRAINT "ChallengeProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CosmeticDefinition" (
  "id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "kind" "CosmeticKind" NOT NULL,
  "displayName" VARCHAR(80) NOT NULL,
  "assetKey" VARCHAR(160) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "CosmeticDefinition_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "UserCosmetic" (
  "userId" TEXT NOT NULL,
  "cosmeticId" TEXT NOT NULL,
  "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "equippedAt" TIMESTAMP(3),
  CONSTRAINT "UserCosmetic_pkey" PRIMARY KEY ("userId", "cosmeticId")
);
CREATE INDEX "UserCosmetic_userId_equippedAt_idx" ON "UserCosmetic"("userId", "equippedAt");
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserCosmetic" ADD CONSTRAINT "UserCosmetic_cosmeticId_fkey" FOREIGN KEY ("cosmeticId") REFERENCES "CosmeticDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SafetyReport" (
  "id" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "matchId" TEXT,
  "reason" "ReportReason" NOT NULL,
  "details" VARCHAR(500),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SafetyReport_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SafetyReport_reporterId_createdAt_idx" ON "SafetyReport"("reporterId", "createdAt");
CREATE INDEX "SafetyReport_targetUserId_createdAt_idx" ON "SafetyReport"("targetUserId", "createdAt");
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SafetyReport" ADD CONSTRAINT "SafetyReport_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "UserBlock" (
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserBlock_pkey" PRIMARY KEY ("blockerId", "blockedId")
);
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
