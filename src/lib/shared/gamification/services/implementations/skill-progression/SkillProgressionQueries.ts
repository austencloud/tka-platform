import type {
  SkillProgression,
  UserSkillProgress,
} from "../../../domain/models/challenge-models";

export function getMasteredSkillsFromProgress(params: {
  allSkills: SkillProgression[];
  allProgress: Map<string, UserSkillProgress>;
}): SkillProgression[] {
  const { allSkills, allProgress } = params;

  const completedSkillIds: string[] = [];
  allProgress.forEach((progress, skillId) => {
    if (progress.isCompleted) {
      completedSkillIds.push(skillId);
    }
  });

  return allSkills.filter((skill) => completedSkillIds.includes(skill.skillId));
}

export async function getSkillsInProgressFromProgress(params: {
  allProgress: Map<string, UserSkillProgress>;
  getSkillById: (skillId: string) => Promise<SkillProgression | null>;
}): Promise<Array<{ skill: SkillProgression; progress: UserSkillProgress }>> {
  const { allProgress, getSkillById } = params;

  const result: Array<{
    skill: SkillProgression;
    progress: UserSkillProgress;
  }> = [];

  for (const [skillId, progress] of allProgress) {
    if (!progress.isCompleted && progress.currentLevel > 0) {
      const skill = await getSkillById(skillId);
      if (skill) {
        result.push({ skill, progress });
      }
    }
  }

  return result;
}

export async function getRecentCompletionsFromProgress(params: {
  allProgress: Map<string, UserSkillProgress>;
  getSkillById: (skillId: string) => Promise<SkillProgression | null>;
  now: Date;
  daysBack: number;
}): Promise<
  Array<{ skill: SkillProgression; level: number; completedAt: Date }>
> {
  const { allProgress, getSkillById, now, daysBack } = params;

  const since = new Date(now);
  since.setDate(since.getDate() - daysBack);

  const completions: Array<{
    skill: SkillProgression;
    level: number;
    completedAt: Date;
  }> = [];

  for (const [skillId, progress] of allProgress) {
    if (progress.lastProgressAt >= since) {
      const skill = await getSkillById(skillId);
      if (skill) {
        const lastLevel =
          progress.completedLevels[progress.completedLevels.length - 1];
        if (lastLevel) {
          completions.push({
            skill,
            level: lastLevel,
            completedAt: progress.lastProgressAt,
          });
        }
      }
    }
  }

  return completions.sort(
    (a, b) => b.completedAt.getTime() - a.completedAt.getTime()
  );
}
