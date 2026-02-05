/**
 * Leaderboard Models
 * Domain models for community leaderboards and rankings
 */

export type LeaderboardCategory =
  | "xp"
  | "level"
  | "sequences"
  | "achievements"
  | "streak"
  | "weekly_challenges"
  | "skill_mastery";

export type LeaderboardTier = "gold" | "silver" | "bronze";

export type LeaderboardTimeframe = "week" | "month" | "all_time";

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  username: string;
  avatar?: string;

  // Category-specific metrics
  totalXP?: number;
  currentLevel?: number;
  sequenceCount?: number;
  achievementCount?: number;
  currentStreak?: number;
  longestStreak?: number;
  weeklyChallengesCompleted?: number;
  skillsCompleted?: number;

  // Contextual data
  rankChange?: number; // +5 (went up 5 ranks), -2 (went down)
  isCurrentUser?: boolean;
  tier?: LeaderboardTier; // Top 3 visual treatment
}

export interface LeaderboardData {
  category: LeaderboardCategory;
  timeframe?: LeaderboardTimeframe;
  entries: LeaderboardEntry[];
  currentUserRank?: number;
  totalUsers: number;
  lastUpdated: Date;
}

export interface RankHistoryEntry {
  date: string;
  rank: number;
  value: number; // The metric value at that rank
}

export interface LeaderboardQueryOptions {
  limit?: number;
  offset?: number;
  includeCurrentUser?: boolean;
  timeframe?: LeaderboardTimeframe;
}
