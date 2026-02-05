/**
 * Daily Challenge Service Interface
 *
 * Handles daily challenge generation, tracking, and completion.
 */

import type {
  DailyChallenge,
  UserChallengeProgress,
  XPEventMetadata,
} from "../../domain/models/achievement-models";

export interface IDailyChallengeManager {
  /**
   * Initialize the daily challenge system
   * Generates today's challenge if it doesn't exist
   */
  initialize(): Promise<void>;

  /**
   * Get today's daily challenge
   * Returns null if admin hasn't created one yet
   */
  getTodayChallenge(): Promise<DailyChallenge | null>;

  /**
   * Get user's progress on today's challenge
   */
  getChallengeProgress(): Promise<UserChallengeProgress | null>;

  /**
   * Update progress on current daily challenge
   * Returns true if challenge was completed
   */
  updateChallengeProgress(
    progressDelta: number,
    metadata?: XPEventMetadata
  ): Promise<{
    completed: boolean;
    progress: UserChallengeProgress;
  }>;

  /**
   * Mark today's challenge as complete
   * Awards XP automatically
   */
  completeChallenge(): Promise<{
    xpAwarded: number;
    challenge: DailyChallenge;
  }>;

  /**
   * Get challenge history (last N days)
   */
  getChallengeHistory(days?: number): Promise<
    Array<{
      challenge: DailyChallenge;
      progress: UserChallengeProgress | null;
    }>
  >;

  /**
   * Check if user has completed today's challenge
   */
  isTodayChallengeComplete(): Promise<boolean>;

  /**
   * Get challenge completion stats
   */
  getChallengeStats(): Promise<{
    totalChallengesCompleted: number;
    currentStreak: number;
    longestStreak: number;
  }>;
}
