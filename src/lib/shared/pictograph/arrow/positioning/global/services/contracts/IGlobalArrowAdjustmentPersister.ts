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
   * @param previousX Previous X value before this change (for history)
   * @param previousY Previous Y value before this change (for history)
   * @param action History action type
   */
  save(
    input: GlobalArrowAdjustmentInput,
    userEmail: string,
    previousX?: number,
    previousY?: number,
    action?: "save" | "delete" | "reset" | "undo"
  ): Promise<void>;

  /**
   * Delete an adjustment from Firestore
   * @param keyString The composite key string
   * @param previousX Previous X value before deletion (for history)
   * @param previousY Previous Y value before deletion (for history)
   * @param userEmail Admin email (for history)
   * @param historyInput Key fields for the history record
   */
  delete(
    keyString: string,
    previousX?: number,
    previousY?: number,
    userEmail?: string,
    historyInput?: {
      gridMode: string;
      oriKey: string;
      letter: string;
      turnsTuple: string;
      arrowKey: string;
      propType?: string;
      otherPropType?: string;
    }
  ): Promise<void>;

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
