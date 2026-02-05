/**
 * Global Arrow Adjustment Persister Contract
 *
 * Handles Firestore persistence for global arrow adjustments.
 */

import type {
  GlobalArrowAdjustment,
  GlobalArrowAdjustmentInput,
} from "../../domain/GlobalArrowAdjustment";

export interface IGlobalArrowAdjustmentPersister {
  /**
   * Load all global adjustments from Firestore
   */
  loadAll(): Promise<GlobalArrowAdjustment[]>;

  /**
   * Save a single adjustment to Firestore
   * @param input The adjustment data to save
   * @param userEmail The email of the admin making the change
   */
  save(input: GlobalArrowAdjustmentInput, userEmail: string): Promise<void>;

  /**
   * Delete an adjustment from Firestore
   * @param keyString The composite key string
   */
  delete(keyString: string): Promise<void>;

  /**
   * Subscribe to real-time updates from Firestore
   * @param onAdd Called when an adjustment is added or modified
   * @param onRemove Called when an adjustment is deleted
   * @returns Unsubscribe function
   */
  subscribe(
    onAdd: (adjustment: GlobalArrowAdjustment) => void,
    onRemove: (keyString: string) => void
  ): () => void;
}
