/**
 * ILibraryActManager - Act (Playlist) Management
 *
 * Service for creating and managing performance acts (sequence playlists).
 */

import type { Act, ActItem } from "../../domain/models/Act";
import type { LibrarySequence } from "../../domain/models/LibrarySequence";

/**
 * ILibraryActManager - Act CRUD operations
 */
export interface ILibraryActManager {
  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * Create a new act
   * @param name Act name
   * @param description Optional description
   * @returns The created act
   */
  createAct(name: string, description?: string): Promise<Act>;

  /**
   * Get an act by ID
   * @param actId The act ID
   * @returns The act or null
   */
  getAct(actId: string): Promise<Act | null>;

  /**
   * Update act metadata
   * @param actId The act ID
   * @param updates Partial updates
   * @returns The updated act
   */
  updateAct(
    actId: string,
    updates: Partial<
      Pick<
        Act,
        | "name"
        | "description"
        | "coverImageUrl"
        | "isPublic"
        | "defaultPlaybackSpeed"
        | "loopAct"
      >
    >
  ): Promise<Act>;

  /**
   * Delete an act
   * @param actId The act ID
   */
  deleteAct(actId: string): Promise<void>;

  /**
   * Get all acts for current user
   * @returns Array of acts
   */
  getActs(): Promise<Act[]>;

  // ============================================================
  // SEQUENCE MANAGEMENT
  // ============================================================

  /**
   * Add a sequence to an act
   * @param actId Target act ID
   * @param sequenceId Sequence ID to add
   * @param position Optional position (appends if not specified)
   */
  addSequenceToAct(
    actId: string,
    sequenceId: string,
    position?: number
  ): Promise<void>;

  /**
   * Remove a sequence from an act
   * @param actId Act ID
   * @param position Position of the sequence to remove
   */
  removeSequenceFromAct(actId: string, position: number): Promise<void>;

  /**
   * Reorder sequences in an act
   * @param actId Act ID
   * @param sequenceIds Ordered array of sequence IDs
   */
  reorderActSequences(actId: string, sequenceIds: string[]): Promise<void>;

  /**
   * Update an item's configuration (transitions, repeats, notes)
   * @param actId Act ID
   * @param position Item position
   * @param updates Item updates
   */
  updateActItem(
    actId: string,
    position: number,
    updates: Partial<Omit<ActItem, "sequenceId" | "position">>
  ): Promise<void>;

  /**
   * Get all sequences in an act (in order)
   * @param actId Act ID
   * @returns Array of sequences in act order
   */
  getActSequences(actId: string): Promise<LibrarySequence[]>;

  // ============================================================
  // PLAYBACK SUPPORT
  // ============================================================

  /**
   * Calculate total duration of an act
   * @param actId Act ID
   * @returns Estimated duration in seconds
   */
  calculateActDuration(actId: string): Promise<number>;

  /**
   * Export act as a single combined sequence
   * Merges all sequences into one
   * @param actId Act ID
   * @returns Combined sequence
   */
  exportActAsSequence(actId: string): Promise<LibrarySequence>;

  /**
   * Duplicate an act
   * @param actId Act ID to duplicate
   * @param newName Name for the duplicate
   * @returns The duplicated act
   */
  duplicateAct(actId: string, newName: string): Promise<Act>;

  // ============================================================
  // REAL-TIME SUBSCRIPTIONS
  // ============================================================

  /**
   * Subscribe to all acts
   * @param callback Called with updated acts
   * @returns Unsubscribe function
   */
  subscribeToActs(callback: (acts: Act[]) => void): () => void;

  /**
   * Subscribe to a specific act
   * @param actId Act ID
   * @param callback Called with act or null
   * @returns Unsubscribe function
   */
  subscribeToAct(
    actId: string,
    callback: (act: Act | null) => void
  ): () => void;
}
