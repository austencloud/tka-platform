import type {
  SkillProgression,
  UserSkillProgress,
} from "../../../domain/models/challenge-models";

export type SkillProgressUpdate =
  | {
      kind: "noop";
      progress: UserSkillProgress;
      levelCompleted: false;
      skillCompleted: false;
      xpAwarded: 0;
    }
  | {
      kind: "progress_updated";
      updatedProgress: UserSkillProgress;
      newLevelProgress: number;
      levelCompleted: false;
      skillCompleted: false;
      xpAwarded: 0;
    }
  | {
      kind: "level_completed";
      updatedProgress: UserSkillProgress;
      completedLevels: number[];
      levelCompleted: true;
      skillCompleted: boolean;
      xpAwarded: number;
    };

export function computeSkillProgressUpdate(params: {
  skill: SkillProgression;
  currentProgress: UserSkillProgress;
  progressDelta: number;
  now: Date;
}): SkillProgressUpdate {
  const { skill, currentProgress, progressDelta, now } = params;

  const currentLevel = skill.levels[currentProgress.currentLevel - 1];
  if (!currentLevel) {
    return {
      kind: "noop",
      progress: currentProgress,
      levelCompleted: false,
      skillCompleted: false,
      xpAwarded: 0,
    };
  }

  const newLevelProgress = currentProgress.levelProgress + progressDelta;
  const levelCompleted = newLevelProgress >= currentLevel.requirement.target;

  if (!levelCompleted) {
    const updatedProgress: UserSkillProgress = {
      ...currentProgress,
      levelProgress: newLevelProgress,
      lastProgressAt: now,
    };

    return {
      kind: "progress_updated",
      updatedProgress,
      newLevelProgress,
      levelCompleted: false,
      skillCompleted: false,
      xpAwarded: 0,
    };
  }

  const xpAwarded = currentLevel.xpReward;
  const completedLevels = [
    ...currentProgress.completedLevels,
    currentProgress.currentLevel,
  ];
  const nextLevel = currentProgress.currentLevel + 1;
  const skillCompleted = nextLevel > skill.totalLevels;

  const updatedProgress: UserSkillProgress = {
    ...currentProgress,
    currentLevel: skillCompleted ? skill.totalLevels : nextLevel,
    levelProgress: 0,
    isCompleted: skillCompleted,
    completedLevels,
    lastProgressAt: now,
    completedAt: skillCompleted ? now : undefined,
  };

  return {
    kind: "level_completed",
    updatedProgress,
    completedLevels,
    levelCompleted: true,
    skillCompleted,
    xpAwarded,
  };
}
