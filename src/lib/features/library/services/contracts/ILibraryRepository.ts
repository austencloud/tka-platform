/**
 * ILibraryRepository - Core Library CRUD Operations
 *
 * Main service for managing sequences in a user's library.
 * All operations are implicitly scoped to the current authenticated user.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type {
  LibrarySequence,
  SequenceVisibility,
} from "../../domain/models/LibrarySequence";

/**
 * Statistics about a user's library
 */
export interface LibraryStats {
  /** Total sequences in library */
  totalSequences: number;
  /** Sequences created by user */
  createdSequences: number;
  /** Sequences forked from others */
  forkedSequences: number;
  /** Public sequences */
  publicSequences: number;
  /** Private sequences */
  privateSequences: number;
  /** Total collections */
  totalCollections: number;
  /** Total acts (playlists) */
  totalActs: number;
  /** Total steps across all sequences */
  totalSteps: number;
}

/**
 * Options for querying library sequences
 */
export interface LibraryQueryOptions {
  /** Filter by source type */
  source?: "created" | "forked" | "all";
  /** Filter by visibility */
  visibility?: SequenceVisibility | "all";
  /** Filter by collection ID */
  collectionId?: string;
  /** Filter by tag IDs */
  tagIds?: string[];
  /** Filter by favorite status */
  isFavorite?: boolean;
  /** Search query (name, word) */
  searchQuery?: string;
  /** Sort field */
  sortBy?: "name" | "createdAt" | "updatedAt" | "sequenceLength";
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Maximum results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * ILibraryRepository - Core library operations
 */
export interface ILibraryRepository {
  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * Save a sequence to the user's library
   * Creates new or updates existing based on ID
   * @param sequence The sequence data to save
   * @returns The saved LibrarySequence with all metadata
   */
  saveSequence(sequence: SequenceData): Promise<LibrarySequence>;

  /**
   * Save a sequence with explicit metadata from the UI save panel.
   * Like saveSequence(), but accepts name, visibility, tags, notes, and thumbnail.
   * All post-write side effects (public sync, achievements, conflict detection,
   * offline tracking) are handled identically to saveSequence().
   */
  saveSequenceWithMetadata(
    sequence: SequenceData,
    metadata: {
      name: string;
      displayName?: string;
      visibility: SequenceVisibility;
      tags: string[];
      notes: string;
      thumbnailUrl?: string;
    }
  ): Promise<LibrarySequence>;

  /**
   * Get a sequence by ID from user's library
   * @param sequenceId The sequence ID
   * @returns The sequence or null if not found
   */
  getSequence(sequenceId: string): Promise<LibrarySequence | null>;

  /**
   * Update an existing sequence in user's library
   * @param sequenceId The sequence ID
   * @param updates Partial updates to apply
   * @returns The updated sequence
   */
  updateSequence(
    sequenceId: string,
    updates: Partial<LibrarySequence>
  ): Promise<LibrarySequence>;

  /**
   * Delete a sequence from user's library
   * Also removes from public index if public
   * @param sequenceId The sequence ID
   */
  deleteSequence(sequenceId: string): Promise<void>;

  /**
   * Get all sequences in user's library
   * @param options Query options for filtering, sorting, pagination
   * @returns Array of library sequences
   */
  getSequences(options?: LibraryQueryOptions): Promise<LibrarySequence[]>;

  /**
   * Check if a sequence with this content hash already exists in the user's library.
   * Used by the action bar to determine whether to show Save or Edit.
   * @param contentHash SHA-256 hash of motion content
   * @returns true if a matching sequence exists
   */
  hasMatchingContent(contentHash: string): Promise<boolean>;

  /**
   * Get sequences for a specific user (useful for viewing other users' profiles)
   * @param userId The user ID to get sequences for
   * @param options Query options for filtering, sorting, pagination
   * @returns Array of library sequences for that user
   */
  getUserSequences(
    userId: string,
    options?: LibraryQueryOptions
  ): Promise<LibrarySequence[]>;

  // ============================================================
  // SOFT DELETE (RECYCLE BIN)
  // ============================================================

  /**
   * Soft-delete a sequence (move to recycle bin).
   * Sets isDeleted=true and deletedAt=now.
   * Removes from public index if public.
   */
  softDeleteSequence(sequenceId: string): Promise<void>;

  /**
   * Restore a soft-deleted sequence from the recycle bin.
   * Clears isDeleted and deletedAt.
   */
  restoreSequence(sequenceId: string): Promise<void>;

  /**
   * Permanently delete a soft-deleted sequence.
   * Only works on sequences where isDeleted=true.
   */
  purgeSequence(sequenceId: string): Promise<void>;

  /**
   * Get all soft-deleted sequences (recycle bin contents).
   */
  getDeletedSequences(): Promise<LibrarySequence[]>;

  /**
   * Permanently delete all soft-deleted sequences.
   */
  emptyRecycleBin(): Promise<void>;

  // ============================================================
  // VISIBILITY MANAGEMENT
  // ============================================================

  /**
   * Set the visibility of a sequence
   * Handles syncing to public index when making public
   * @param sequenceId The sequence ID
   * @param visibility The new visibility level
   */
  setVisibility(
    sequenceId: string,
    visibility: SequenceVisibility
  ): Promise<void>;

  /**
   * Publish a sequence to the public feed
   * Shorthand for setVisibility(id, "public")
   * Awards XP for first publication
   * @param sequenceId The sequence ID
   */
  publishSequence(sequenceId: string): Promise<void>;

  /**
   * Unpublish a sequence (make private)
   * Shorthand for setVisibility(id, "private")
   * @param sequenceId The sequence ID
   */
  unpublishSequence(sequenceId: string): Promise<void>;

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  /**
   * Subscribe to user's library changes
   * Callback fires on any add/update/delete
   * @param callback Called with updated sequences array
   * @returns Unsubscribe function
   */
  subscribeToLibrary(
    callback: (sequences: LibrarySequence[]) => void,
    options?: LibraryQueryOptions
  ): () => void;

  /**
   * Subscribe to a specific sequence
   * @param sequenceId The sequence ID
   * @param callback Called with sequence or null if deleted
   * @returns Unsubscribe function
   */
  subscribeToSequence(
    sequenceId: string,
    callback: (sequence: LibrarySequence | null) => void
  ): () => void;

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get library statistics for current user
   * @returns Library statistics
   */
  getLibraryStats(): Promise<LibraryStats>;

  // ============================================================
  // BATCH OPERATIONS
  // ============================================================

  /**
   * Delete multiple sequences
   * @param sequenceIds Array of sequence IDs to delete
   */
  deleteSequences(sequenceIds: string[]): Promise<void>;

  /**
   * Move sequences to a collection
   * @param sequenceIds Array of sequence IDs
   * @param collectionId Target collection ID
   */
  moveToCollection(sequenceIds: string[], collectionId: string): Promise<void>;

  /**
   * Add tags to sequences
   * @param sequenceIds Array of sequence IDs
   * @param tagIds Tag IDs to add
   */
  addTagsToSequences(sequenceIds: string[], tagIds: string[]): Promise<void>;

  /**
   * Set visibility for multiple sequences
   * @param sequenceIds Array of sequence IDs
   * @param visibility New visibility level
   */
  setVisibilityBatch(
    sequenceIds: string[],
    visibility: SequenceVisibility
  ): Promise<void>;

  // ============================================================
  // FAVORITES
  // ============================================================

  /**
   * Toggle favorite status of a sequence
   * @param sequenceId The sequence ID
   * @returns New favorite status
   */
  toggleFavorite(sequenceId: string): Promise<boolean>;

  /**
   * Get all favorited sequences
   * @returns Array of favorited sequences
   */
  getFavorites(): Promise<LibrarySequence[]>;
}
