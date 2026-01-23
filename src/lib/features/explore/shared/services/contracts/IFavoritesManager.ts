/**
 * Service for managing user favorites
 *
 * @deprecated Use ICollectionManager from the library module instead.
 * Favorites are now stored as a system collection in Firestore.
 *
 * Migration guide:
 * - toggleFavorite() -> ICollectionManager.toggleFavorite()
 * - isFavorite() -> ICollectionManager.isFavorite()
 * - getFavorites() -> ICollectionManager.getFavoriteIds()
 * - Get full sequences: ICollectionManager.getFavorites()
 *
 * The old FavoritesManager used session storage and data was lost on refresh.
 * The new system persists favorites in Firestore as part of the user's collections.
 */
export interface IFavoritesManager {
  /** Toggle favorite status for a sequence */
  toggleFavorite(sequenceId: string): Promise<void>;

  /** Check if sequence is favorited */
  isFavorite(sequenceId: string): Promise<boolean>;

  /** Get all favorited sequence IDs */
  getFavorites(): Promise<string[]>;

  /** Set favorite status for a sequence */
  setFavorite(sequenceId: string, isFavorite: boolean): Promise<void>;

  /** Remove all favorites */
  clearFavorites(): Promise<void>;

  /** Get favorites count */
  getFavoritesCount(): Promise<number>;
}
