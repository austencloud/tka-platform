/**
 * Enhanced User Profile Models
 * Extends base UserProfile with gamification and social data
 */

import type { Achievement } from "$lib/shared/gamification/domain/models/achievement-models";
import type { UserRole } from "$lib/shared/auth/domain/models/user-role";
import type { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import type { PinnedItem } from "./pinned-item";

/**
 * Base User Profile
 * Used by IEnhancedUserService and community components
 */
export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatar?: string;
  // NOTE: Email deliberately omitted - user documents are publicly readable
  // Email is available via Firebase Auth for the user themselves
  sequenceCount: number;
  collectionCount: number;
  followerCount: number;
  joinedDate: Date;
  lastActiveAt?: Date;
  isFollowing?: boolean;

  // Social links
  instagramUsername?: string;
  pronouns?: string;

  // Prop preferences
  /** Props this creator uses (e.g. ["staff", "fan", "club"]) */
  propsISpinWith?: PropType[];
  /** Their single primary identity prop */
  favoriteProp?: PropType | null;
  /** Optional catdog combo favorite */
  favoriteCatdog?: {
    bluePropType: PropType;
    redPropType: PropType;
  } | null;

  // Profile accent color (hex, e.g. "#8b5cf6") for avatar ring and cards
  profileColor?: string;

  /** Pinned showcase items (1-6, any content type) */
  pinnedItems?: PinnedItem[];

  // Admin-related fields
  role?: UserRole;
  isDisabled?: boolean;
  isHidden?: boolean;

  // Warning-related fields
  hasActiveWarning?: boolean;
  lastWarningAt?: Date;
  lastWarningReportId?: string;

  // Admin-only fields (never shown to users)
  adminLabel?: string; // Quick identifier (e.g., "Jake from Tuesday jam")
  adminNotes?: string;
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

export type CreatorSortCriteria = "lastActive" | "joinedDate" | "favoriteProp";

export interface CreatorQueryOptions {
  filter?: CreatorFilterType;
  sortBy?: CreatorSortCriteria;
  limit?: number;
  offset?: number;
  /** Filter to creators who spin with these props */
  propFilter?: PropType[];
}
