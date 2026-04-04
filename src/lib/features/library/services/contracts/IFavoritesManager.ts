/**
 * IFavoritesManager - Favorites Collection Operations
 *
 * Convenience interface for managing the Favorites system collection.
 * Delegates to the underlying collection membership operations.
 */

import type { LibrarySequence } from "../../domain/models/LibrarySequence";

export interface IFavoritesManager {
  /**
   * Toggle favorite status for a sequence.
   * Adds to or removes from the Favorites collection.
   * @returns true if now favorited, false if unfavorited
   */
  toggleFavorite(sequenceId: string): Promise<boolean>;

  /**
   * Check if a sequence is favorited
   */
  isFavorite(sequenceId: string): Promise<boolean>;

  /**
   * Get all favorited sequences with full data
   */
  getFavorites(): Promise<LibrarySequence[]>;

  /**
   * Get favorited sequence IDs only (lightweight)
   */
  getFavoriteIds(): Promise<Set<string>>;
}
