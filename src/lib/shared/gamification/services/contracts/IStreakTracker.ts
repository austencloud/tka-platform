/**
 * Streak Service Interface
 *
 * Handles daily login/activity streak tracking.
 */

import type { UserStreak } from "../../domain/models/achievement-models";

export interface IStreakTracker {
  /**
   * Initialize streak tracking
   */
  initialize(): Promise<void>;

  /**
   * Record daily activity (call once per day)
   * Returns true if streak was incremented
   */
  recordDailyActivity(): Promise<{
    streakIncremented: boolean;
    currentStreak: number;
    isNewRecord: boolean;
  }>;

  /**
   * Get current streak data
   */
  getCurrentStreak(): Promise<UserStreak>;

  /**
   * Check if user has checked in today
   */
  hasCheckedInToday(): Promise<boolean>;

  /**
   * Get streak statistics
   */
  getStreakStats(): Promise<{
    currentStreak: number;
    longestStreak: number;
    totalDaysActive: number;
    lastActivityDate: string;
  }>;

  /**
   * Check if streak was broken
   * Returns number of days since last activity
   */
  checkStreakStatus(): Promise<{
    isActive: boolean;
    daysSinceLastActivity: number;
  }>;
}
