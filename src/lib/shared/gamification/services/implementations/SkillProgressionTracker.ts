/**
 * Skill Progression Service Implementation
 *
 * Manages skill progression tracking with Firebase/Firestore.
 * Skills represent long-term goals across Letter Mastery, Concept Mastery, and Practice Goals.
 */

import { auth } from "../../../auth/firebase";
import type {
  SkillProgression,
  UserSkillProgress,
  SkillCategory,
  SkillLevel,
} from "../../domain/models/challenge-models";
import type {
  ISkillProgressionTracker,
  SkillProgressActionType,
  SkillProgressMetadata,
} from "../contracts/ISkillProgressionTracker";
import type { AchievementManager } from '$lib/shared/gamification/services/implementations/AchievementManager'
import { calculateSkillStats } from "./skill-progression/SkillProgressionStats";
import { getRecommendedSkills } from "./skill-progression/SkillProgressionRecommendations";
import { findRelevantSkills } from "./skill-progression/SkillProgressionRelevantSkills";
import { getCompletedSkillIdsFromProgress } from "./skill-progression/SkillProgressionCompletedSkills";
import { loadAllUserSkillProgress } from "./skill-progression/SkillProgressionPersistence";
import {
  getActiveSkillById,
  getActiveSkills,
  getActiveSkillsByCategory,
} from "./skill-progression/SkillProgressionDefinitions";
import {
  getAvailableSkills as getAvailableSkillsForUser,
  getLockedSkills as getLockedSkillsForUser,
} from "./skill-progression/SkillProgressionAvailability";
import {
  getCategoryPossibleLevels,
  getUserProgressByCategory as getUserProgressByCategoryFromProgress,
} from "./skill-progression/SkillProgressionCategory";
import {
  getMasteredSkillsFromProgress,
  getRecentCompletionsFromProgress,
  getSkillsInProgressFromProgress,
} from "./skill-progression/SkillProgressionQueries";
import {
  startSkillForUser,
  trackSkillActionForUser,
  updateSkillProgressForUser,
} from "./skill-progression/SkillProgressionMutations";

export class SkillProgressionTracker implements ISkillProgressionTracker {
  private _initialized = false;
  private _achievementService: AchievementManager | null = null;
  private _userProgressCache: Map<string, UserSkillProgress> = new Map();

  constructor(achievementService: AchievementManager) {
    this._achievementService = achievementService;
  }

  async initialize(): Promise<void> {
    if (this._initialized) {
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      return;
    }

    // Load user's skill progress into cache
    await this.getAllUserProgress();

    this._initialized = true;
  }

  async getAllSkills(): Promise<SkillProgression[]> {
    return getActiveSkills();
  }

  async getSkillsByCategory(
    category: SkillCategory
  ): Promise<SkillProgression[]> {
    return getActiveSkillsByCategory(category);
  }

  async getSkillById(skillId: string): Promise<SkillProgression | null> {
    return getActiveSkillById(skillId);
  }

  async getAvailableSkills(): Promise<SkillProgression[]> {
    const user = auth.currentUser;
    if (!user) return [];

    const completedSkillIds = await this._getCompletedSkillIds();
    const userLevel = await this._getUserLevel();

    return getAvailableSkillsForUser({ completedSkillIds, userLevel });
  }

  async getLockedSkills(): ReturnType<
    ISkillProgressionTracker["getLockedSkills"]
  > {
    const user = auth.currentUser;
    if (!user) return [];

    const completedSkillIds = await this._getCompletedSkillIds();
    const userLevel = await this._getUserLevel();
    return getLockedSkillsForUser({ completedSkillIds, userLevel });
  }

  async getAllUserProgress(): Promise<Map<string, UserSkillProgress>> {
    const user = auth.currentUser;
    if (!user) return new Map();

    return loadAllUserSkillProgress({
      userId: user.uid,
      cache: this._userProgressCache,
    });
  }

  async getUserProgress(skillId: string): Promise<UserSkillProgress | null> {
    const allProgress = await this.getAllUserProgress();
    return allProgress.get(skillId) || null;
  }

  async getUserProgressByCategory(
    category: SkillCategory
  ): ReturnType<ISkillProgressionTracker["getUserProgressByCategory"]> {
    const allProgress = await this.getAllUserProgress();
    const categorySkills = await this.getSkillsByCategory(category);
    return getUserProgressByCategoryFromProgress({
      allProgress,
      categorySkills,
    });
  }

  async startSkill(skillId: string): Promise<UserSkillProgress> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    return startSkillForUser({
      userId: user.uid,
      skillId,
      cache: this._userProgressCache,
      getSkillById: (id) => this.getSkillById(id),
      getUserProgress: (id) => this.getUserProgress(id),
      getAvailableSkills: () => this.getAvailableSkills(),
    });
  }

  async updateSkillProgress(
    skillId: string,
    progressDelta: number
  ): ReturnType<ISkillProgressionTracker["updateSkillProgress"]> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error("No user logged in");
    }

    return updateSkillProgressForUser({
      userId: user.uid,
      skillId,
      progressDelta,
      cache: this._userProgressCache,
      getSkillById: (id) => this.getSkillById(id),
      getUserProgress: (id) => this.getUserProgress(id),
      startSkill: (id) => this.startSkill(id),
      achievementService: this._achievementService,
    });
  }

  async trackAction(
    actionType: SkillProgressActionType,
    metadata: SkillProgressMetadata
  ): ReturnType<ISkillProgressionTracker["trackAction"]> {
    return trackSkillActionForUser({
      findRelevantSkills: () => this._findRelevantSkills(actionType, metadata),
      updateSkillProgress: (id, delta) => this.updateSkillProgress(id, delta),
    });
  }

  async getCurrentLevel(skillId: string): Promise<SkillLevel | null> {
    const skill = await this.getSkillById(skillId);
    if (!skill) return null;

    const progress = await this.getUserProgress(skillId);
    if (!progress || progress.currentLevel === 0) {
      return skill.levels[0] || null;
    }

    return skill.levels[progress.currentLevel - 1] || null;
  }

  async getNextLevel(skillId: string): Promise<SkillLevel | null> {
    const skill = await this.getSkillById(skillId);
    if (!skill) return null;

    const progress = await this.getUserProgress(skillId);
    if (!progress || progress.isCompleted) {
      return null;
    }

    return skill.levels[progress.currentLevel] || null;
  }

  async canLevelUp(skillId: string): Promise<boolean> {
    const skill = await this.getSkillById(skillId);
    if (!skill) return false;

    const progress = await this.getUserProgress(skillId);
    if (!progress || progress.isCompleted) return false;

    const currentLevel = skill.levels[progress.currentLevel - 1];
    if (!currentLevel) return false;

    return progress.levelProgress >= currentLevel.requirement.target;
  }

  async levelUp(skillId: string): Promise<{
    success: boolean;
    newLevel: number;
    xpAwarded: number;
    skillCompleted: boolean;
  }> {
    const canLevel = await this.canLevelUp(skillId);
    if (!canLevel) {
      const progress = await this.getUserProgress(skillId);
      return {
        success: false,
        newLevel: progress?.currentLevel || 0,
        xpAwarded: 0,
        skillCompleted: false,
      };
    }

    // Force completion of current level
    const result = await this.updateSkillProgress(skillId, 9999);

    return {
      success: result.levelCompleted,
      newLevel: result.progress.currentLevel,
      xpAwarded: result.xpAwarded,
      skillCompleted: result.skillCompleted,
    };
  }

  async isSkillMastered(skillId: string): Promise<boolean> {
    const progress = await this.getUserProgress(skillId);
    return progress?.isCompleted ?? false;
  }

  async getMasteredSkills(): Promise<SkillProgression[]> {
    const allProgress = await this.getAllUserProgress();
    const allSkills = await this.getAllSkills();
    return getMasteredSkillsFromProgress({ allSkills, allProgress });
  }

  async getSkillsInProgress(): ReturnType<
    ISkillProgressionTracker["getSkillsInProgress"]
  > {
    const allProgress = await this.getAllUserProgress();
    return getSkillsInProgressFromProgress({
      allProgress,
      getSkillById: (id) => this.getSkillById(id),
    });
  }

  async getRecentCompletions(): ReturnType<
    ISkillProgressionTracker["getRecentCompletions"]
  > {
    const allProgress = await this.getAllUserProgress();
    return getRecentCompletionsFromProgress({
      allProgress,
      getSkillById: (id) => this.getSkillById(id),
      now: new Date(),
      daysBack: 7,
    });
  }

  async getStats(): ReturnType<ISkillProgressionTracker["getStats"]> {
    const allSkills = await this.getAllSkills();
    const allProgress = await this.getAllUserProgress();

    return calculateSkillStats({ allSkills, allProgress });
  }

  async getCategoryStats(
    category: SkillCategory
  ): ReturnType<ISkillProgressionTracker["getCategoryStats"]> {
    const stats = await this.getStats();
    const catStats = stats.byCategory.get(category);

    if (!catStats) {
      return {
        total: 0,
        started: 0,
        mastered: 0,
        levelsCompleted: 0,
        totalPossibleLevels: 0,
        completionPercentage: 0,
      };
    }

    const categorySkills = await this.getSkillsByCategory(category);
    const totalPossibleLevels = getCategoryPossibleLevels({ categorySkills });
    const completionPercentage =
      totalPossibleLevels > 0
        ? Math.round((catStats.levelsCompleted / totalPossibleLevels) * 100)
        : 0;

    return {
      ...catStats,
      totalPossibleLevels,
      completionPercentage,
    };
  }

  async getRecommendedSkills(
    limit: number = 5
  ): ReturnType<ISkillProgressionTracker["getRecommendedSkills"]> {
    const allProgress = await this.getAllUserProgress();
    const availableSkills = await this.getAvailableSkills();
    return getRecommendedSkills({ limit, allProgress, availableSkills });
  }

  private async _getCompletedSkillIds(): Promise<string[]> {
    const allProgress = await this.getAllUserProgress();
    return getCompletedSkillIdsFromProgress(allProgress);
  }

  private async _getUserLevel(): Promise<number> {
    if (!this._achievementService) return 1;

    try {
      const xp = await this._achievementService.getUserXP();
      return xp.currentLevel;
    } catch {
      return 1;
    }
  }

  private async _findRelevantSkills(
    actionType: SkillProgressActionType,
    metadata: SkillProgressMetadata
  ): Promise<Array<{ skill: SkillProgression; progressDelta: number }>> {
    const availableSkills = await this.getAvailableSkills();
    const allProgress = await this.getAllUserProgress();
    return findRelevantSkills({
      availableSkills,
      allProgress,
      actionType,
      metadata,
    });
  }
}
