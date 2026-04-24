/**
 * FavoritesManager - Favorites Collection Operations
 *
 * Manages the Favorites system collection. Delegates to
 * ICollectionManager for the underlying collection membership.
 */

import { getActivityLogger } from "$lib/shared/analytics/getActivityLogger";
import type { IActivityLogger } from "$lib/shared/analytics/services/contracts/IActivityLogger";
import type { IFavoritesManager } from "../contracts/IFavoritesManager";
import type { ICollectionManager } from "../contracts/ICollectionManager";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

export class FavoritesManager implements IFavoritesManager {
  constructor(private collectionManager: ICollectionManager) {}

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
