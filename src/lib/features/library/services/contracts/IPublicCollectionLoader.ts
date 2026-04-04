/**
 * IPublicCollectionLoader - Read-only access to other users' public collections
 *
 * Used by the Browse module and Following Feed to display
 * another user's public collections and favorites.
 */

import type { LibraryCollection } from "../../domain/models/Collection";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

export interface IPublicCollectionLoader {
  /**
   * Get a user's public collections
   */
  getUserPublicCollections(userId: string): Promise<LibraryCollection[]>;

  /**
   * Get sequences from another user's public collection.
   * Returns empty array if collection is not public.
   */
  getUserCollectionSequences(
    userId: string,
    collectionId: string
  ): Promise<LibrarySequence[]>;

  /**
   * Get another user's favorite sequence IDs if their favorites are public.
   * Respects the user's favoritesPublic privacy setting.
   */
  getUserPublicFavoriteIds(userId: string): Promise<string[]>;
}
