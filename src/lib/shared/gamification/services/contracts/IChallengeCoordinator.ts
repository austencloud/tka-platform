/**
 * Challenge Coordinator Interface
 *
 * Provides a unified facade for managing all challenge types:
 * Daily Challenges, Weekly Challenges, and Skill Progressions.
 * This service coordinates across the individual services and provides
 * aggregated data for the UI.
 */

import type {
  DailyChallenge,
  UserChallengeProgress,
  XPActionType,
  XPEventMetadata,
} from "../../domain/models/achievement-models";
import type {
  WeeklyChallenge,
  UserWeeklyChallengeProgress,
  SkillProgression,
  UserSkillProgress,
  SkillCategory,
  ChallengeDashboard,
  LeaderboardCategory,
  LeaderboardTimeframe,
  LeaderboardData,
} from "../../domain/models/challenge-models";

export interface IChallengeCoordinator {
  /**
   * Initialize all challenge services
   */
  initialize(): Promise<void>;

  // ============================================================================
  // UNIFIED DASHBOARD
  // ============================================================================

  /**
   * Get complete dashboard data for the Challenges tab
   * Aggregates data from all challenge services
   */
  getDashboard(): Promise<ChallengeDashboard>;

  /**
   * Get quick stats for header/summary display
   */
  getQuickStats(): Promise<{
    dailyProgress: { current: number; target: number; isComplete: boolean };
    weeklyProgress: { current: number; target: number; isComplete: boolean };
    currentStreak: number;
    totalXP: number;
    currentLevel: number;
  }>;

  // ============================================================================
  // DAILY CHALLENGES
  // ============================================================================

  /**
   * Get today's daily challenge with progress
   */
  getTodaysChallenge(): Promise<{
    challenge: DailyChallenge | null;
    progress: UserChallengeProgress | null;
    timeRemaining: { hours: number; minutes: number } | null;
  }>;

  /**
   * Update daily challenge progress
   */
  updateDailyProgress(
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    xpAwarded: number;
    newStreak?: number;
  }>;

  // ============================================================================
  // WEEKLY CHALLENGES
  // ============================================================================

  /**
   * Get this week's challenge with progress
   */
  getWeeklyChallenge(): Promise<{
    challenge: WeeklyChallenge | null;
    progress: UserWeeklyChallengeProgress | null;
    timeRemaining: { days: number; hours: number } | null;
    bonusTimeRemaining: { days: number; hours: number } | null;
  }>;

  /**
   * Update weekly challenge progress
   */
  updateWeeklyProgress(
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    xpAwarded: number;
    bonusEarned: boolean;
  }>;

  /**
   * Get weekly challenge history
   */
  getWeeklyHistory(weeks?: number): Promise<
    Array<{
      challenge: WeeklyChallenge;
      progress: UserWeeklyChallengeProgress | null;
    }>
  >;

  // ============================================================================
  // SKILL PROGRESSIONS
  // ============================================================================

  /**
   * Get skill progressions overview
   */
  getSkillsOverview(): Promise<{
    inProgress: Array<{ skill: SkillProgression; progress: UserSkillProgress }>;
    available: SkillProgression[];
    completed: SkillProgression[];
    recommendations: Array<{
      skill: SkillProgression;
      reason: string;
      progress?: UserSkillProgress;
    }>;
  }>;

  /**
   * Get skills by category with progress
   */
  getSkillsByCategory(category: SkillCategory): Promise<{
    skills: SkillProgression[];
    progressMap: Map<string, UserSkillProgress>;
    categoryStats: {
      total: number;
      started: number;
      mastered: number;
      completionPercentage: number;
    };
  }>;

  /**
   * Start a new skill
   */
  startSkill(skillId: string): Promise<UserSkillProgress>;

  /**
   * Update skill progress
   */
  updateSkillProgress(
    skillId: string,
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    levelCompleted: boolean;
    skillCompleted: boolean;
    xpAwarded: number;
    progress: UserSkillProgress;
  }>;

  // ============================================================================
  // UNIFIED ACTION TRACKING
  // ============================================================================

  /**
   * Track an action across all challenge types
   * This is the main entry point for tracking user actions
   * It will update daily, weekly, and skill progress as appropriate
   */
  trackAction(
    action: XPActionType,
    metadata?: XPEventMetadata
  ): Promise<{
    xpGained: number;
    dailyChallengeProgress?: { completed: boolean; progress: number };
    weeklyChallengeProgress?: { completed: boolean; progress: number };
    skillsUpdated: Array<{
      skillId: string;
      levelCompleted: boolean;
      skillCompleted: boolean;
    }>;
  }>;

  // ============================================================================
  // LEADERBOARDS
  // ============================================================================

  /**
   * Get leaderboard data
   */
  getLeaderboard(
    category: LeaderboardCategory,
    timeframe: LeaderboardTimeframe,
    limit?: number
  ): Promise<LeaderboardData>;

  /**
   * Get current user's rank for a category
   */
  getUserRank(
    category: LeaderboardCategory,
    timeframe: LeaderboardTimeframe
  ): Promise<{
    rank: number;
    totalUsers: number;
    percentile: number;
  }>;

  // ============================================================================
  // NOTIFICATIONS & REMINDERS
  // ============================================================================

  /**
   * Get pending challenge notifications
   */
  getPendingNotifications(): Promise<
    Array<{
      type:
        | "daily_reminder"
        | "weekly_reminder"
        | "streak_at_risk"
        | "bonus_expiring";
      message: string;
      actionLabel?: string;
      priority: "low" | "medium" | "high";
    }>
  >;

  /**
   * Dismiss a notification
   */
  dismissNotification(notificationId: string): Promise<void>;

  // ============================================================================
  // STATISTICS
  // ============================================================================

  /**
   * Get comprehensive statistics
   */
  getFullStats(): Promise<{
    challenges: {
      dailyCompleted: number;
      weeklyCompleted: number;
      currentDailyStreak: number;
      longestDailyStreak: number;
      currentWeeklyStreak: number;
      bonusesEarned: number;
    };
    skills: {
      totalSkills: number;
      skillsStarted: number;
      skillsMastered: number;
      levelsCompleted: number;
      completionPercentage: number;
    };
    xp: {
      totalXP: number;
      currentLevel: number;
      xpToNextLevel: number;
      xpFromChallenges: number;
      xpFromSkills: number;
    };
  }>;
}
