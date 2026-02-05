import type { UserSkillProgress } from "../../../domain/models/challenge-models";

type TimestampLike = { toDate?: () => Date } | undefined;

function toDateOrNow(value: TimestampLike): Date {
  return value?.toDate?.() || new Date();
}

function toDateOrUndefined(value: TimestampLike): Date | undefined {
  return value?.toDate?.();
}

export function firestoreDataToUserSkillProgress(params: {
  userId: string;
  docId: string;
  data: Record<string, unknown>;
}): UserSkillProgress {
  const { userId, docId, data } = params;

  const startedAt = data["startedAt"] as TimestampLike;
  const lastProgressAt = data["lastProgressAt"] as TimestampLike;
  const completedAt = data["completedAt"] as TimestampLike;

  return {
    id: docId,
    skillId: data["skillId"] as string,
    userId,
    currentLevel: (data["currentLevel"] as number) || 0,
    levelProgress: (data["levelProgress"] as number) || 0,
    isCompleted: (data["isCompleted"] as boolean) || false,
    startedAt: toDateOrNow(startedAt),
    lastProgressAt: toDateOrNow(lastProgressAt),
    completedLevels: (data["completedLevels"] as number[]) || [],
    completedAt: toDateOrUndefined(completedAt),
  };
}
