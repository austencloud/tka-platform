/**
 * Enhanced User Profile Models
 * Extends base UserProfile with gamification and social data
 */

import type { Achievement } from "$lib/shared/gamification/domain/models/achievement-models";
import type { UserRole } from "$lib/shared/auth/domain/models/UserRole";

/**
 * Base User Profile
 * Used by IEnhancedUserService and community components
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  email?: string;
  sequenceCount: number;
  collectionCount: number;
  followerCount: number;
  joinedDate: Date;
  isFollowing?: boolean;

  // Social links
  instagramUsername?: string;

  // Admin-related fields
  role?: UserRole;
  isDisabled?: boolean;

  // Warning-related fields
  hasActiveWarning?: boolean;
  lastWarningAt?: Date;
  lastWarningReportId?: string;
}

export interface EnhancedUserProfile extends UserProfile {
  // Base UserProfile fields:
  // id, username, displayName, avatar, email, sequenceCount, collectionCount, followerCount, joinedDate, isFollowing

  // Gamification additions
  totalXP: number;
  currentLevel: number;
  achievementCount: number;
  currentStreak: number;
  longestStreak: number;
  topAchievements: Achievement[]; // Top 3-5 most impressive achievements

  // Social additions
  isFeatured: boolean;
  bio?: string;
  followingCount: number;

  // Rankings (optional - for display on profile cards)
  rank?: {
    xp: number;
    level: number;
    sequences: number;
    achievements: number;
  };
}

export type CreatorFilterType =
  | "all"
  | "featured"
  | "most-sequences"
  | "highest-level"
  | "most-followers"
  | "newest";

export type CreatorSortCriteria =
  | "xp"
  | "level"
  | "sequences"
  | "achievements"
  | "followers"
  | "joinedDate";

export interface CreatorQueryOptions {
  filter?: CreatorFilterType;
  sortBy?: CreatorSortCriteria;
  limit?: number;
  offset?: number;
}
