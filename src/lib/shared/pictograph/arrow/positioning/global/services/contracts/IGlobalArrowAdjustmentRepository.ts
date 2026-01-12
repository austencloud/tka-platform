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
   * Save an adjustment (admin only)
   * @throws Error if user is not admin
   */
  saveAdjustment(input: GlobalArrowAdjustmentInput): Promise<void>;

  /**
   * Delete an adjustment (admin only)
   * @throws Error if user is not admin
   */
  deleteAdjustment(key: GlobalAdjustmentKey): Promise<void>;

  /**
   * Check if the current user is an admin
   */
  isAdmin(): boolean;

  /**
   * Dispose of resources (unsubscribe from Firestore)
   */
  dispose(): void;
}
