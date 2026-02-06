import type {
  SkillProgression,
  UserSkillProgress,
} from "../../../domain/models/challenge-models";

export function getRecommendedSkills(params: {
  limit: number;
  allProgress: Map<string, UserSkillProgress>;
  availableSkills: SkillProgression[];
}): Array<{
  skill: SkillProgression;
  reason: "continue" | "new" | "almost_complete" | "trending";
  progress?: UserSkillProgress;
}> {
  const { limit, allProgress, availableSkills } = params;

  const recommendations: Array<{
    skill: SkillProgression;
    reason: "continue" | "new" | "almost_complete" | "trending";
    progress?: UserSkillProgress;
    priority: number;
  }> = [];

  for (const skill of availableSkills) {
    const progress = allProgress.get(skill.skillId);
    if (progress && !progress.isCompleted) {
      const currentLevel = skill.levels[progress.currentLevel - 1];
      if (currentLevel) {
        const completionRatio =
          progress.levelProgress / currentLevel.requirement.target;
        if (completionRatio >= 0.75) {
          recommendations.push({
            skill,
            reason: "almost_complete",
            progress,
            priority: 1,
          });
        } else {
          recommendations.push({
            skill,
            reason: "continue",
            progress,
            priority: 2,
          });
        }
      }
    }
  }

  const newSkills = availableSkills.filter((s) => !allProgress.has(s.skillId));
  for (const skill of newSkills.slice(0, 3)) {
    recommendations.push({
      skill,
      reason: "new",
      priority: 3,
    });
  }

  recommendations.sort((a, b) => a.priority - b.priority);

  return recommendations.slice(0, limit).map(({ skill, reason, progress }) => ({
    skill,
    reason,
    progress,
  }));
}
