import type {
  SkillProgression,
  UserSkillProgress,
} from "../../domain/models/challenge-models";
import type { AchievementManager } from '$lib/shared/gamification/services/achievement-manager'
import { computeSkillProgressUpdate } from "./skill-progression-update";
import {
  persistSkillProgressIncrement,
  persistSkillProgressLevelCompletion,
  persistStartedSkill,
} from "./skill-progression-persistence";

type UpdateSkillProgressResult = {
  progress: UserSkillProgress;
  levelCompleted: boolean;
  skillCompleted: boolean;
  xpAwarded: number;
};
type TrackActionResult = Array<{
  skillId: string;
  progressDelta: number;
  levelCompleted: boolean;
  skillCompleted: boolean;
}>;

export async function startSkillForUser(params: {
  userId: string;
  skillId: string;
  cache: Map<string, UserSkillProgress>;
  getSkillById: (skillId: string) => Promise<SkillProgression | null>;
  getUserProgress: (skillId: string) => Promise<UserSkillProgress | null>;
  getAvailableSkills: () => Promise<SkillProgression[]>;
  log?: (message: string) => void;
}): Promise<UserSkillProgress> {
  const {
    userId,
    skillId,
    cache,
    getSkillById,
    getUserProgress,
    getAvailableSkills,
  } = params;
  const log = params.log ?? console.log;

  const skill = await getSkillById(skillId);
  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  const existing = await getUserProgress(skillId);
  if (existing) {
    return existing;
  }

  const available = await getAvailableSkills();
  if (!available.find((s) => s.skillId === skillId)) {
    throw new Error(`Skill is locked: ${skillId}`);
  }

  const progress: UserSkillProgress = {
    id: `${userId}_${skillId}`,
    skillId,
    userId,
    currentLevel: 1,
    levelProgress: 0,
    isCompleted: false,
    startedAt: new Date(),
    lastProgressAt: new Date(),
    completedLevels: [],
  };

  await persistStartedSkill({
    userId,
    skillId,
    progress,
    cache,
  });

  log(`Started skill: ${skill.skillName}`);

  return progress;
}

export async function updateSkillProgressForUser(params: {
  userId: string;
  skillId: string;
  progressDelta: number;
  cache: Map<string, UserSkillProgress>;
  getSkillById: (skillId: string) => Promise<SkillProgression | null>;
  getUserProgress: (skillId: string) => Promise<UserSkillProgress | null>;
  startSkill: (skillId: string) => Promise<UserSkillProgress>;
  achievementService: AchievementManager | null;
  log?: (message: string) => void;
}): Promise<UpdateSkillProgressResult> {
  const {
    userId,
    skillId,
    progressDelta,
    cache,
    getSkillById,
    getUserProgress,
    startSkill,
    achievementService,
  } = params;
  const log = params.log ?? console.log;

  const skill = await getSkillById(skillId);
  if (!skill) {
    throw new Error(`Skill not found: ${skillId}`);
  }

  let currentProgress = await getUserProgress(skillId);
  if (!currentProgress) {
    currentProgress = await startSkill(skillId);
  }

  if (currentProgress.isCompleted) {
    return {
      progress: currentProgress,
      levelCompleted: false,
      skillCompleted: false,
      xpAwarded: 0,
    };
  }

  const update = computeSkillProgressUpdate({
    skill,
    currentProgress,
    progressDelta,
    now: new Date(),
  });

  if (update.kind === "noop") {
    return {
      progress: update.progress,
      levelCompleted: update.levelCompleted,
      skillCompleted: update.skillCompleted,
      xpAwarded: update.xpAwarded,
    };
  }

  if (update.kind === "level_completed") {
    await persistSkillProgressLevelCompletion({
      userId,
      skillId,
      updatedProgress: update.updatedProgress,
      completedLevels: update.completedLevels,
      skillCompleted: update.skillCompleted,
      cache,
    });

    if (achievementService) {
      await achievementService.trackAction("skill_level_completed", {
        skillId,
        skillLevel: currentProgress.currentLevel,
        skillCategory: skill.skillCategory,
      });

      if (update.skillCompleted) {
        await achievementService.trackAction("skill_mastery_achieved", {
          skillId,
          skillCategory: skill.skillCategory,
        });
      }
    }

    log(
      `Skill level completed: ${skill.skillName} Level ${currentProgress.currentLevel}${update.skillCompleted ? " (MASTERED!)" : ""}`
    );

    return {
      progress: update.updatedProgress,
      levelCompleted: update.levelCompleted,
      skillCompleted: update.skillCompleted,
      xpAwarded: update.xpAwarded,
    };
  }

  await persistSkillProgressIncrement({
    userId,
    skillId,
    updatedProgress: update.updatedProgress,
    newLevelProgress: update.newLevelProgress,
    cache,
  });

  return {
    progress: update.updatedProgress,
    levelCompleted: update.levelCompleted,
    skillCompleted: update.skillCompleted,
    xpAwarded: update.xpAwarded,
  };
}

export async function trackSkillActionForUser(params: {
  findRelevantSkills: () => Promise<
    Array<{ skill: SkillProgression; progressDelta: number }>
  >;
  updateSkillProgress: (
    skillId: string,
    progressDelta: number
  ) => Promise<UpdateSkillProgressResult>;
  logError?: (message: string, error: unknown) => void;
}): Promise<TrackActionResult> {
  const { findRelevantSkills, updateSkillProgress } = params;
  const logError = params.logError ?? ((msg, err) => console.error(msg, err));

  const results: TrackActionResult = [];
  const relevantSkills = await findRelevantSkills();

  for (const { skill, progressDelta } of relevantSkills) {
    try {
      const result = await updateSkillProgress(skill.skillId, progressDelta);
      results.push({
        skillId: skill.skillId,
        progressDelta,
        levelCompleted: result.levelCompleted,
        skillCompleted: result.skillCompleted,
      });
    } catch (error) {
      logError(`Failed to update skill ${skill.skillId}:`, error);
    }
  }

  return results;
}
