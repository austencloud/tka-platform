import type {
  SkillCategory,
  SkillProgression,
  UserSkillProgress,
} from "../../../domain/models/challenge-models";

export function calculateSkillStats(params: {
  allSkills: SkillProgression[];
  allProgress: Map<string, UserSkillProgress>;
}): {
  totalSkills: number;
  skillsStarted: number;
  skillsInProgress: number;
  skillsMastered: number;
  totalLevelsCompleted: number;
  totalPossibleLevels: number;
  completionPercentage: number;
  xpFromSkills: number;
  byCategory: Map<
    SkillCategory,
    {
      total: number;
      started: number;
      mastered: number;
      levelsCompleted: number;
    }
  >;
} {
  const { allSkills, allProgress } = params;

  let skillsStarted = 0;
  let skillsInProgress = 0;
  let skillsMastered = 0;
  let totalLevelsCompleted = 0;
  let totalPossibleLevels = 0;
  let xpFromSkills = 0;

  const byCategory = new Map<
    SkillCategory,
    {
      total: number;
      started: number;
      mastered: number;
      levelsCompleted: number;
    }
  >();

  const categories: SkillCategory[] = [
    "letter_mastery",
    "concept_mastery",
    "practice_goals",
  ];
  for (const cat of categories) {
    byCategory.set(cat, {
      total: 0,
      started: 0,
      mastered: 0,
      levelsCompleted: 0,
    });
  }

  for (const skill of allSkills) {
    totalPossibleLevels += skill.totalLevels;

    const catStats = byCategory.get(skill.skillCategory)!;
    catStats.total++;

    const progress = allProgress.get(skill.skillId);
    if (!progress) continue;

    skillsStarted++;
    catStats.started++;

    if (progress.isCompleted) {
      skillsMastered++;
      catStats.mastered++;
      totalLevelsCompleted += skill.totalLevels;
      catStats.levelsCompleted += skill.totalLevels;

      for (const level of skill.levels) {
        xpFromSkills += level.xpReward;
      }
    } else {
      skillsInProgress++;
      totalLevelsCompleted += progress.completedLevels.length;
      catStats.levelsCompleted += progress.completedLevels.length;

      for (const levelNum of progress.completedLevels) {
        const level = skill.levels[levelNum - 1];
        if (level) {
          xpFromSkills += level.xpReward;
        }
      }
    }
  }

  const completionPercentage =
    totalPossibleLevels > 0
      ? Math.round((totalLevelsCompleted / totalPossibleLevels) * 100)
      : 0;

  return {
    totalSkills: allSkills.length,
    skillsStarted,
    skillsInProgress,
    skillsMastered,
    totalLevelsCompleted,
    totalPossibleLevels,
    completionPercentage,
    xpFromSkills,
    byCategory,
  };
}
