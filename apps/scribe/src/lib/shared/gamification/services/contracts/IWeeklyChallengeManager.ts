/**
 * Weekly Challenge Service Interface
 *
 * Handles weekly challenge management, tracking, and completion.
 * Weekly challenges span Monday-Sunday and offer larger rewards than daily challenges.
 */

import type { XPEventMetadata } from "../../domain/models/achievement-models";
import type {
  WeeklyChallenge,
  UserWeeklyChallengeProgress,
} from "../../domain/models/challenge-models";

export interface IWeeklyChallengeManager {
  /**
   * Initialize the weekly challenge system
   * Loads current week's challenge if it exists
   */
  initialize(): Promise<void>;

  /**
   * Get the current week's challenge
   * Returns null if admin hasn't created one yet
   */
  getCurrentWeekChallenge(): Promise<WeeklyChallenge | null>;

  /**
   * Get a specific week's challenge by year and week number
   */
  getWeekChallenge(
    year: number,
    weekNumber: number
  ): Promise<WeeklyChallenge | null>;

  /**
   * Get user's progress on current week's challenge
   */
  getWeeklyProgress(): Promise<UserWeeklyChallengeProgress | null>;

  /**
   * Update progress on current weekly challenge
   * Returns completion status and whether bonus was earned
   */
  updateWeeklyProgress(
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    progress: UserWeeklyChallengeProgress;
    bonusEarned: boolean;
  }>;

  /**
   * Mark current week's challenge as complete
   * Awards XP automatically (with bonus if applicable)
   */
  completeWeeklyChallenge(): Promise<{
    xpAwarded: number;
    bonusXP: number;
    challenge: WeeklyChallenge;
  }>;

  /**
   * Check if current week's challenge is complete
   */
  isCurrentWeekChallengeComplete(): Promise<boolean>;

  /**
   * Check if bonus deadline has passed for current challenge
   */
  isBonusDeadlinePassed(): Promise<boolean>;

  /**
   * Get weekly challenge history (last N weeks)
   */
  getWeeklyChallengeHistory(weeks?: number): Promise<
    Array<{
      challenge: WeeklyChallenge;
      progress: UserWeeklyChallengeProgress | null;
    }>
  >;

  /**
   * Get weekly challenge completion stats
   */
  getWeeklyStats(): Promise<{
    totalWeeklyChallengesCompleted: number;
    currentWeeklyStreak: number;
    longestWeeklyStreak: number;
    totalBonusesEarned: number;
  }>;

  /**
   * Get time remaining until current week challenge expires
   * Returns null if no active challenge
   */
  getTimeRemaining(): Promise<{
    days: number;
    hours: number;
    minutes: number;
    totalMilliseconds: number;
  } | null>;

  /**
   * Get time remaining until bonus deadline
   * Returns null if no bonus deadline or already passed
   */
  getBonusTimeRemaining(): Promise<{
    days: number;
    hours: number;
    minutes: number;
    totalMilliseconds: number;
  } | null>;
}
