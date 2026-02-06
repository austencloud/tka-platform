/**
 * ILeaderboardManager
 * Service contract for leaderboard data and rankings
 */

import type {
  LeaderboardCategory,
  LeaderboardData,
  LeaderboardQueryOptions,
  RankHistoryEntry,
} from "../../domain/models/leaderboard-models";

export interface ILeaderboardManager {
  /**
   * Get ranked leaderboard for a specific category
   */
  getLeaderboard(
    category: LeaderboardCategory,
    options?: LeaderboardQueryOptions
  ): Promise<LeaderboardData>;

  /**
   * Get current user's rank in a specific category
   */
  getCurrentUserRank(category: LeaderboardCategory): Promise<number | null>;

  /**
   * Get any user's rank in a specific category
   */
  getUserRank(
    userId: string,
    category: LeaderboardCategory
  ): Promise<number | null>;

  /**
   * Subscribe to real-time leaderboard updates
   */
  subscribeToLeaderboard(
    category: LeaderboardCategory,
    callback: (data: LeaderboardData) => void,
    options?: LeaderboardQueryOptions
  ): () => void;

  /**
   * Get rank change history over time period
   */
  getRankHistory(
    userId: string,
    category: LeaderboardCategory,
    period: "day" | "week" | "month"
  ): RankHistoryEntry[];

  /**
   * Refresh leaderboard cache
   */
  refreshLeaderboard(category: LeaderboardCategory): void;
}
