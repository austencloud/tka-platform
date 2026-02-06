/**
 * ITrainChallengeManager - Train Challenge Service Interface
 *
 * Manages train challenges: fetching from Firestore, tracking progress,
 * and recording completions.
 */

import type {
  TrainChallenge,
  UserTrainChallengeProgress,
  TrainChallengeFilters,
  TrainChallengeScore,
} from "../../domain/models/TrainChallengeModels";

export interface ITrainChallengeManager {
  /**
   * Fetch all active challenges from Firestore
   */
  getActiveChallenges(): Promise<TrainChallenge[]>;

  /**
   * Fetch a specific challenge by ID
   */
  getChallengeById(challengeId: string): Promise<TrainChallenge | null>;

  /**
   * Fetch filtered and sorted challenges
   */
  getChallenges(filters: TrainChallengeFilters): Promise<TrainChallenge[]>;

  /**
   * Get user's progress for all challenges
   */
  getUserChallengeProgress(): Promise<UserTrainChallengeProgress[]>;

  /**
   * Get user's progress for a specific challenge
   */
  getUserProgressForChallenge(
    challengeId: string
  ): Promise<UserTrainChallengeProgress | null>;

  /**
   * Record progress toward a challenge
   * @param challengeId Challenge ID
   * @param increment Amount to increment progress by
   * @param score Optional score data for the attempt
   */
  recordProgress(
    challengeId: string,
    increment: number,
    score?: TrainChallengeScore
  ): Promise<void>;

  /**
   * Start tracking a challenge (creates initial progress record)
   */
  startChallenge(challengeId: string): Promise<void>;

  /**
   * Complete a challenge and award XP
   * @param challengeId Challenge ID
   * @param finalScore Final score data
   * @returns XP awarded (base + bonus if applicable)
   */
  completeChallenge(
    challengeId: string,
    finalScore: TrainChallengeScore
  ): Promise<number>;

  /**
   * Check if user has completed a challenge
   */
  isChallengeCompleted(challengeId: string): Promise<boolean>;

  /**
   * Get completion stats
   */
  getCompletionStats(): Promise<{
    totalChallenges: number;
    completedChallenges: number;
    totalXPEarned: number;
    bonusXPEarned: number;
  }>;
}
