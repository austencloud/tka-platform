/**
 * ITagManager - Tag Management Operations
 *
 * Service for managing user-defined tags for categorizing sequences.
 * All operations are implicitly scoped to the current authenticated user.
 */

import type { LibraryTag, CreateTagOptions } from "../../domain/models/Tag";

/**
 * ITagManager - Tag CRUD and management operations
 */
export interface ITagManager {
  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new tag
   * Normalizes the tag name and checks for duplicates
   * @param name Tag name (will be normalized)
   * @param options Optional color and icon
   * @returns The created tag (or existing if duplicate name found)
   */
  createTag(name: string, options?: CreateTagOptions): Promise<LibraryTag>;

  /**
   * Get a tag by ID
   * @param tagId The tag ID
   * @returns The tag or null if not found
   */
  getTag(tagId: string): Promise<LibraryTag | null>;

  /**
   * Get all tags for the current user
   * @returns Array of tags sorted by name
   */
  getAllTags(): Promise<LibraryTag[]>;

  /**
   * Update a tag
   * @param tagId The tag ID
   * @param updates Partial updates (name, color, icon)
   * @returns The updated tag
   */
  updateTag(
    tagId: string,
    updates: Partial<Pick<LibraryTag, "name" | "color" | "icon">>
  ): Promise<LibraryTag>;

  /**
   * Delete a tag
   * Does NOT remove tag associations from sequences
   * @param tagId The tag ID
   */
  deleteTag(tagId: string): Promise<void>;

  // ============================================================
  // TAG NORMALIZATION & DEDUPLICATION
  // ============================================================

  /**
   * Normalize a tag name (lowercase, trim)
   * @param name Raw tag name
   * @returns Normalized tag name
   */
  normalizeTagName(name: string): string;

  /**
   * Find a tag by name (case-insensitive)
   * @param name Tag name to search for
   * @returns The tag or null if not found
   */
  findTagByName(name: string): Promise<LibraryTag | null>;

  // ============================================================
  // USE COUNT MANAGEMENT
  // ============================================================

  /**
   * Increment the use count for a tag
   * Called when a tag is added to a sequence
   * @param tagId The tag ID
   */
  incrementUseCount(tagId: string): Promise<void>;

  /**
   * Decrement the use count for a tag
   * Called when a tag is removed from a sequence
   * @param tagId The tag ID
   */
  decrementUseCount(tagId: string): Promise<void>;

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  /**
   * Subscribe to all tags for the current user
   * @param callback Called with updated tags array
   * @returns Unsubscribe function
   */
  subscribeToTags(callback: (tags: LibraryTag[]) => void): () => void;
}
