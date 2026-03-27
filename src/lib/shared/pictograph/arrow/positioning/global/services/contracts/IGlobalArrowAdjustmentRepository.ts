/**
 * Global Arrow Adjustment Repository Contract
 *
 * Coordinates state and persistence for global arrow adjustments.
 * Provides the main interface for the rendering pipeline and UI.
 */

import type { Point } from "fabric";
import type {
  GlobalAdjustmentKey,
  GlobalArrowAdjustment,
  GlobalArrowAdjustmentInput,
} from "../../domain/GlobalArrowAdjustment";

/**
 * Result of a cascading adjustment lookup.
 * Includes the adjustment point and which layer it was found at.
 */
export interface CascadingLookupResult {
  /** The adjustment offset as a Point */
  adjustment: Point;
  /** Which layer the adjustment was found at: 1 (base), 2 (prop-specific), or 3 (combination) */
  layer: 1 | 2 | 3;
}

export interface IGlobalArrowAdjustmentRepository {
  /**
   * Check if the repository is initialized
   */
  readonly isInitialized: boolean;

  /**
   * Initialize the repository - load all adjustments and start subscription
   */
  initialize(): Promise<void>;

  /**
   * Get adjustment by key components
   * Returns Point if found, null otherwise
   */
  getAdjustment(key: GlobalAdjustmentKey): Point | null;

  /**
   * Get full adjustment data by key
   */
  getFullAdjustment(key: GlobalAdjustmentKey): GlobalArrowAdjustment | null;

  /**
   * Check if an adjustment exists
   */
  hasAdjustment(key: GlobalAdjustmentKey): boolean;

  /**
   * Cascading lookup: Layer 3 → Layer 2 → Layer 1.
   *
   * Searches for the most specific adjustment available:
   * 1. First checks Layer 3 (combination-specific: this prop + other prop)
   * 2. Then checks Layer 2 (prop-specific: just this prop)
   * 3. Finally checks Layer 1 (base: no prop types, typically staff defaults)
   *
   * @param baseKey The 5-part base key (without prop types)
   * @param thisPropType The prop type for this arrow (lowercase: "staff", "fan", etc.)
   * @param otherPropType The other hand's prop type (lowercase)
   * @returns The adjustment and which layer it was found at, or null if no adjustment exists
   */
  getAdjustmentCascading(
    baseKey: GlobalAdjustmentKey,
    thisPropType: string,
    otherPropType: string,
    legacyOriKey?: string
  ): CascadingLookupResult | null;

  /**
   * Save an adjustment to local cache only (admin only).
   * Use this for live preview during WASD adjustment - other pictographs
   * will immediately reflect the change without persisting to Firestore.
   * Call persistAdjustment() or saveAdjustment() to persist to Firestore.
   * @throws Error if user is not admin
   */
  saveAdjustmentLocal(input: GlobalArrowAdjustmentInput): void;

  /**
   * Save an adjustment to Firestore (admin only).
   * Persists to Firestore - use saveAdjustmentLocal() for live preview.
   * @throws Error if user is not admin
   */
  saveAdjustment(input: GlobalArrowAdjustmentInput): Promise<void>;

  /**
   * Delete an adjustment (admin only)
   * @throws Error if user is not admin
   */
  deleteAdjustment(key: GlobalAdjustmentKey): Promise<void>;

  /**
   * Delete an adjustment from local cache only (admin only).
   * Use this for live preview during reset - other pictographs will
   * immediately reflect the removal without persisting to Firestore.
   */
  deleteAdjustmentLocal(key: GlobalAdjustmentKey): void;

  /**
   * Check if the current user is an admin
   */
  isAdmin(): boolean;

  /**
   * Dispose of resources (unsubscribe from Firestore)
   */
  dispose(): void;
}
