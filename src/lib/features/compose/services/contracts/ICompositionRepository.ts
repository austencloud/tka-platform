/**
 * ICompositionRepository - Composition Persistence Operations
 *
 * Repository interface for managing compositions in local storage (Dexie).
 * Compositions are flexible canvas arrangements containing sequences,
 * videos, images, and text in configurable grid layouts.
 */

import type { Composition } from "../../compose/domain/types";

/**
 * Options for querying compositions
 */
export interface CompositionQueryOptions {
  /** Filter by favorite status */
  isFavorite?: boolean;
  /** Search query (name) */
  searchQuery?: string;
  /** Sort field */
  sortBy?: "name" | "createdAt" | "updatedAt";
  /** Sort direction */
  sortDirection?: "asc" | "desc";
  /** Maximum results */
  limit?: number;
  /** Pagination offset */
  offset?: number;
}

/**
 * Statistics about saved compositions
 */
export interface CompositionStats {
  /** Total compositions saved */
  totalCompositions: number;
  /** Favorite compositions */
  favoriteCompositions: number;
  /** Total cells across all compositions */
  totalCells: number;
}

/**
 * ICompositionRepository - Core composition persistence operations
 */
export interface ICompositionRepository {
  // ============================================================
  // CRUD OPERATIONS
  // ============================================================

  /**
   * Save a composition to local storage
   * Creates new or updates existing based on ID
   * @param composition The composition to save
   * @returns The saved composition with updated timestamps
   */
  saveComposition(composition: Composition): Promise<Composition>;

  /**
   * Get a composition by ID
   * @param compositionId The composition ID
   * @returns The composition or null if not found
   */
  getComposition(compositionId: string): Promise<Composition | null>;

  /**
   * Update an existing composition
   * @param compositionId The composition ID
   * @param updates Partial updates to apply
   * @returns The updated composition
   */
  updateComposition(
    compositionId: string,
    updates: Partial<Composition>
  ): Promise<Composition>;

  /**
   * Delete a composition
   * @param compositionId The composition ID
   */
  deleteComposition(compositionId: string): Promise<void>;

  /**
   * Get all compositions with optional filtering
   * @param options Query options for filtering, sorting, pagination
   * @returns Array of compositions
   */
  getCompositions(options?: CompositionQueryOptions): Promise<Composition[]>;

  // ============================================================
  // FAVORITES
  // ============================================================

  /**
   * Toggle favorite status of a composition
   * @param compositionId The composition ID
   * @returns New favorite status
   */
  toggleFavorite(compositionId: string): Promise<boolean>;

  /**
   * Get all favorited compositions
   * @returns Array of favorited compositions
   */
  getFavorites(): Promise<Composition[]>;

  // ============================================================
  // BATCH OPERATIONS
  // ============================================================

  /**
   * Delete multiple compositions
   * @param compositionIds Array of composition IDs to delete
   */
  deleteCompositions(compositionIds: string[]): Promise<void>;

  // ============================================================
  // STATISTICS
  // ============================================================

  /**
   * Get composition statistics
   * @returns Composition statistics
   */
  getStats(): Promise<CompositionStats>;

  // ============================================================
  // UTILITY
  // ============================================================

  /**
   * Check if a composition exists
   * @param compositionId The composition ID
   * @returns True if exists
   */
  exists(compositionId: string): Promise<boolean>;

  /**
   * Get count of compositions
   * @param options Optional query options for filtered count
   * @returns Number of compositions
   */
  count(options?: CompositionQueryOptions): Promise<number>;
}
