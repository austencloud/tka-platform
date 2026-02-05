/**
 * ICollectionManager - Collection (Folder) Management
 *
 * Service for organizing sequences into named collections.
 * Includes system collections (like Favorites) which are auto-created.
 */

import type {
  LibraryCollection,
  SystemCollectionType,
} from "../../domain/models/Collection";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

/**
 * ICollectionManager - Collection CRUD operations
 */
export interface ICollectionManager {
  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new collection
   * @param name Collection name
   * @param description Optional description
   * @returns The created collection
   */
  createCollection(
    name: string,
    description?: string
  ): Promise<LibraryCollection>;

  /**
   * Get a collection by ID
   * @param collectionId The collection ID
   * @returns The collection or null
   */
  getCollection(collectionId: string): Promise<LibraryCollection | null>;

  /**
   * Update collection metadata
   * @param collectionId The collection ID
   * @param updates Partial updates
   * @returns The updated collection
   */
  updateCollection(
    collectionId: string,
    updates: Partial<
      Pick<
        LibraryCollection,
        "name" | "description" | "coverImageUrl" | "color" | "icon" | "isPublic"
      >
    >
  ): Promise<LibraryCollection>;

  /**
   * Delete a collection
   * Note: Does NOT delete sequences, only removes them from collection
   * @param collectionId The collection ID
   */
  deleteCollection(collectionId: string): Promise<void>;

  /**
   * Get all collections for current user
   * @returns Array of collections sorted by sortOrder
   */
  getCollections(): Promise<LibraryCollection[]>;

  // ============================================================
  // SEQUENCE MANAGEMENT
  // ============================================================

  /**
   * Add a sequence to a collection
   * @param collectionId Target collection ID
   * @param sequenceId Sequence ID to add
   */
  addSequenceToCollection(
    collectionId: string,
    sequenceId: string
  ): Promise<void>;

  /**
   * Remove a sequence from a collection
   * @param collectionId Collection ID
   * @param sequenceId Sequence ID to remove
   */
  removeSequenceFromCollection(
    collectionId: string,
    sequenceId: string
  ): Promise<void>;

  /**
   * Get all sequences in a collection
   * @param collectionId The collection ID
   * @returns Array of sequences in the collection
   */
  getCollectionSequences(collectionId: string): Promise<LibrarySequence[]>;

  /**
   * Reorder sequences within a collection
   * @param collectionId The collection ID
   * @param sequenceIds Ordered array of sequence IDs
   */
  reorderSequences(collectionId: string, sequenceIds: string[]): Promise<void>;

  /**
   * Add multiple sequences to a collection
   * @param collectionId Target collection ID
   * @param sequenceIds Array of sequence IDs
   */
  addSequencesToCollection(
    collectionId: string,
    sequenceIds: string[]
  ): Promise<void>;

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  /**
   * Subscribe to all collections
   * @param callback Called with updated collections
   * @returns Unsubscribe function
   */
  subscribeToCollections(
    callback: (collections: LibraryCollection[]) => void
  ): () => void;

  /**
   * Subscribe to a specific collection
   * @param collectionId The collection ID
   * @param callback Called with collection or null
   * @returns Unsubscribe function
   */
  subscribeToCollection(
    collectionId: string,
    callback: (collection: LibraryCollection | null) => void
  ): () => void;

  // ============================================================
  // REORDERING
  // ============================================================

  /**
   * Reorder collections (change sortOrder)
   * @param collectionIds Ordered array of collection IDs
   */
  reorderCollections(collectionIds: string[]): Promise<void>;

  // ============================================================
  // SYSTEM COLLECTIONS
  // ============================================================

  /**
   * Ensure all system collections exist for the current user
   * Called during user initialization or on first library access
   * Idempotent - safe to call multiple times
   */
  ensureSystemCollections(): Promise<void>;

  /**
   * Get a system collection by type
   * Creates it if it doesn't exist
   * @param type The system collection type
   * @returns The system collection
   */
  getSystemCollection(type: SystemCollectionType): Promise<LibraryCollection>;

  /**
   * Get the Favorites collection (convenience method)
   * @returns The favorites collection
   */
  getFavoritesCollection(): Promise<LibraryCollection>;

  // ============================================================
  // FAVORITES OPERATIONS (convenience methods for Favorites collection)
  // ============================================================

  /**
   * Toggle favorite status for a sequence
   * Adds to or removes from the Favorites collection
   * @param sequenceId The sequence to toggle
   * @returns true if now favorited, false if unfavorited
   */
  toggleFavorite(sequenceId: string): Promise<boolean>;

  /**
   * Check if a sequence is favorited
   * @param sequenceId The sequence ID
   * @returns true if in Favorites collection
   */
  isFavorite(sequenceId: string): Promise<boolean>;

  /**
   * Get all favorited sequences
   * @returns Array of sequences in the Favorites collection
   */
  getFavorites(): Promise<LibrarySequence[]>;

  /**
   * Get favorited sequence IDs (lightweight, no full sequence data)
   * @returns Set of sequence IDs that are favorited
   */
  getFavoriteIds(): Promise<Set<string>>;

  // ============================================================
  // PUBLIC COLLECTIONS (for viewing other users' collections)
  // ============================================================

  /**
   * Get a user's public collections
   * @param userId The user whose collections to fetch
   * @returns Array of public collections
   */
  getUserPublicCollections(userId: string): Promise<LibraryCollection[]>;

  /**
   * Get sequences from another user's public collection
   * @param userId The collection owner
   * @param collectionId The collection ID
   * @returns Array of sequences (only if collection is public)
   */
  getUserCollectionSequences(
    userId: string,
    collectionId: string
  ): Promise<LibrarySequence[]>;

  // ============================================================
  // PUBLIC FAVORITES (for Following Feed)
  // ============================================================

  /**
   * Get another user's favorite sequence IDs if their favorites are public
   * Used by the Following Feed to show what people you follow have favorited
   * Respects the user's favoritesPublic privacy setting
   * @param userId The user whose favorites to fetch
   * @returns Array of sequence IDs, or empty array if favorites are private
   */
  getUserPublicFavoriteIds(userId: string): Promise<string[]>;
}
