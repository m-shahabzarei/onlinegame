import "server-only";
import { prisma } from "@/db/client";

export async function saveOnboarding(
  userId: string,
  version: number,
  completed: boolean,
) {
  return prisma.user.update({
    where: { id: userId },
    data: {
      onboardingVersion: version,
      onboardingCompletedAt: completed ? new Date() : null,
    },
    select: { onboardingVersion: true, onboardingCompletedAt: true },
  });
}

export async function saveAnalyticsPreference(userId: string, optOut: boolean) {
  return prisma.user.update({
    where: { id: userId },
    data: { analyticsOptOut: optOut },
    select: { analyticsOptOut: true },
  });
}
