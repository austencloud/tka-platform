/**
 * Achievement Service Interface
 *
 * Handles achievement tracking, unlocking, and XP management.
 */

import type {
  Achievement,
  UserAchievement,
  UserXP,
  XPActionType,
  XPEventMetadata,
} from "../../domain/models/achievement-models";

export interface IAchievementManager {
  /**
   * Initialize the achievement system
   * Sets up default achievements and user XP record if needed
   */
  initialize(): Promise<void>;

  /**
   * Track an XP-gaining action
   * Awards XP and checks for achievement unlocks
   */
  trackAction(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<{
    xpGained: number;
    newLevel?: number;
    achievementsUnlocked: Achievement[];
  }>;

  /**
   * Get user's current XP and level
   */
  getUserXP(): Promise<UserXP>;

  /**
   * Get all achievements and their unlock status
   */
  getAllAchievements(): Promise<
    Array<Achievement & { userProgress: UserAchievement | null }>
  >;

  /**
   * Get achievements by category
   */
  getAchievementsByCategory(
    category: Achievement["category"]
  ): Promise<Array<Achievement & { userProgress: UserAchievement | null }>>;

  /**
   * Get recently unlocked achievements (last 7 days)
   */
  getRecentAchievements(): Promise<UserAchievement[]>;

  /**
   * Get achievement progress for a specific achievement
   */
  getAchievementProgress(
    achievementId: string
  ): Promise<UserAchievement | null>;

  /**
   * Manually award XP (for debugging/testing)
   */
  awardXP(amount: number, reason?: string): Promise<void>;

  /**
   * Check and update achievement progress
   * Returns newly unlocked achievements
   */
  checkAchievementProgress(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<Achievement[]>;

  /**
   * Get total statistics (for UI display)
   */
  getStats(): Promise<{
    totalXP: number;
    currentLevel: number;
    achievementsUnlocked: number;
    totalAchievements: number;
    completionPercentage: number;
  }>;
}
