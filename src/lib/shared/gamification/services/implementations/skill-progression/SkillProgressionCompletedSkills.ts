import type { UserSkillProgress } from "../../../domain/models/challenge-models";

export function getCompletedSkillIdsFromProgress(
  allProgress: Map<string, UserSkillProgress>
): string[] {
  const completed: string[] = [];

  allProgress.forEach((progress, skillId) => {
    if (progress.isCompleted) {
      completed.push(skillId);
    }
  });

  return completed;
}
