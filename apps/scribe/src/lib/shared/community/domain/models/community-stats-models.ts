/**
 * Community Stats Models
 * Models for aggregate community statistics and achievement showcase
 */

import type { Achievement } from "$lib/shared/gamification/domain/models/achievement-models";

export interface CommunityStats {
  totalUsers: number;
  totalSequences: number;
  totalAchievementsUnlocked: number;
  totalXP: number;

  // Achievement breakdown by tier
  achievementsByTier: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
  };

  // Active users
  activeToday: number;
  activeThisWeek: number;
  activeThisMonth: number;

  // Averages
  averageLevel: number;
  averageSequencesPerUser: number;
  averageAchievementCompletion: number; // Percentage

  lastUpdated: Date;
}

export interface AchievementShowcase extends Achievement {
  // Achievement base fields: id, title, description, category, tier, xpReward, icon, requirement

  // Showcase additions
  unlockedByCount: number; // How many users have unlocked it
  unlockedByPercent: number; // % of total users
  rarityScore: number; // 1-100, lower = more rare

  // Recent unlocks (last 5-10)
  recentUnlocks: {
    userId: string;
    displayName: string;
    username: string;
    avatar?: string;
    unlockedAt: Date;
  }[];

  // Top holders (for competitive/tiered achievements)
  topHolders?: {
    userId: string;
    displayName: string;
    username: string;
    avatar?: string;
    progress: number;
  }[];
}

export type AchievementShowcaseFilter = "rare" | "recent" | "categories";

export interface AchievementShowcaseQueryOptions {
  filter: AchievementShowcaseFilter;
  category?: string;
  limit?: number;
}
