/**
 * Favorites Models
 *
 * Interface definitions for managing user favorites and collections.
 * Supports both local session storage and Firestore persistence.
 */

import type { Timestamp } from "firebase/firestore";

/**
 * Firestore document structure for favorites
 * Stored at: users/{userId}/favorites/{sequenceId}
 */
export interface FavoriteDocument {
  sequenceId: string;
  userId: string;
  addedAt: Timestamp;
  isPublic: boolean; // Denormalized from user settings for efficient querying
  tags?: string[];
  notes?: string;
}

/**
 * Client-side representation of a favorite
 */
export interface FavoriteItem {
  sequenceId: string;
  addedDate: Date;
  tags: string[];
  notes?: string;
}

/**
 * Collection of favorites (for local caching)
 */
export interface FavoritesCollection {
  items: FavoriteItem[];
  totalCount: number;
  lastUpdated: Date;
}

/**
 * Migration status tracking
 * Stored in user settings to prevent re-migration
 */
export interface FavoritesMigrationStatus {
  migrated: boolean;
  migratedAt?: Date;
  migratedCount?: number;
}
