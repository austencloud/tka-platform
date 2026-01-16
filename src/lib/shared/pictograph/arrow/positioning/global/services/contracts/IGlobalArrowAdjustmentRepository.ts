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
