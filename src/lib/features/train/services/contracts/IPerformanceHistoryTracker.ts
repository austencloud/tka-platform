/**
 * IPerformanceHistoryTracker - Performance History Interface
 *
 * Manages storage and retrieval of training session history.
 */

import type { StoredPerformance } from "../../domain/models/TrainDatabaseModels";
import type { PerformanceScore } from "../../domain/models/PerformanceData";

export interface PersonalBest {
  sequenceId: string;
  sequenceName: string;
  bestScore: PerformanceScore;
  bestAccuracy: number;
  bestGrade: string;
  bestCombo: number;
  performanceId: string;
  achievedAt: Date;
}

export interface StatsOverview {
  totalSessions: number;
  totalPracticeTime: number; // milliseconds
  averageAccuracy: number;
  maxCombo: number;
}

export interface IPerformanceHistoryTracker {
  /**
   * Save a completed performance session
   */
  savePerformance(performance: StoredPerformance): Promise<void>;

  /**
   * Get recent training sessions
   */
  getRecentSessions(limit: number): Promise<StoredPerformance[]>;

  /**
   * Get personal bests grouped by sequence
   */
  getPersonalBests(): Promise<PersonalBest[]>;

  /**
   * Get overall statistics
   */
  getStatsOverview(): Promise<StatsOverview>;

  /**
   * Get personal best for a specific sequence
   */
  getPersonalBest(sequenceId: string): Promise<PersonalBest | null>;

  /**
   * Delete a session
   */
  deleteSession(sessionId: string): Promise<void>;
}
