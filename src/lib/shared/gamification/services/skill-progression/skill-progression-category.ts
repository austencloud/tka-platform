import type { UserSkillProgress } from "../../domain/models/challenge-models";
import type { SkillProgression } from "../../domain/models/challenge-models";

export function getUserProgressByCategory(params: {
  allProgress: Map<string, UserSkillProgress>;
  categorySkills: SkillProgression[];
}): Map<string, UserSkillProgress> {
  const { allProgress, categorySkills } = params;
  const categorySkillIds = new Set(categorySkills.map((s) => s.skillId));

  const result = new Map<string, UserSkillProgress>();
  allProgress.forEach((progress, skillId) => {
    if (categorySkillIds.has(skillId)) {
      result.set(skillId, progress);
    }
  });

  return result;
}

export function getCategoryPossibleLevels(params: {
  categorySkills: SkillProgression[];
}): number {
  const { categorySkills } = params;
  return categorySkills.reduce((sum, s) => sum + s.totalLevels, 0);
}
