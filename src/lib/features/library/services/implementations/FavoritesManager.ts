/**
 * FavoritesManager - Favorites Collection Operations
 *
 * Manages the Favorites system collection. Delegates to
 * CollectionManager for the underlying collection membership.
 */

import { getActivityLogger } from "$lib/shared/analytics/getActivityLogger";
import type { CollectionManager } from "./CollectionManager";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

export class FavoritesManager {
  constructor(private collectionManager: CollectionManager) {}

  async toggleFavorite(sequenceId: string): Promise<boolean> {
    const favoritesCollection =
      await this.collectionManager.getFavoritesCollection();
    const isFavorited = favoritesCollection.sequenceIds.includes(sequenceId);

    if (isFavorited) {
      await this.collectionManager.removeSequenceFromCollection(
        favoritesCollection.id,
        sequenceId
      );
      this.logFavoriteAction(sequenceId, false);
      return false;
    } else {
      await this.collectionManager.addSequenceToCollection(
        favoritesCollection.id,
        sequenceId
      );
      this.logFavoriteAction(sequenceId, true);
      return true;
    }
  }

  async isFavorite(sequenceId: string): Promise<boolean> {
    const favoritesCollection =
      await this.collectionManager.getFavoritesCollection();
    return favoritesCollection.sequenceIds.includes(sequenceId);
  }

  async getFavorites(): Promise<LibrarySequence[]> {
    const favoritesCollection =
      await this.collectionManager.getFavoritesCollection();
    return this.collectionManager.getCollectionSequences(
      favoritesCollection.id
    );
  }

  async getFavoriteIds(): Promise<Set<string>> {
    const favoritesCollection =
      await this.collectionManager.getFavoritesCollection();
    return new Set(favoritesCollection.sequenceIds);
  }

  private logFavoriteAction(sequenceId: string, isFavorite: boolean): void {
    const activityService = getActivityLogger();
    if (activityService) {
      activityService.log(
        isFavorite ? "sequence_favorite" : "sequence_unfavorite",
        "social",
        { sequenceId }
      );
    }
  }
}
