/**
 * IArrowAdjustmentOrchestrator
 *
 * Orchestrates arrow adjustment operations including:
 * - Applying WASD movement with coordinate transformation
 * - Managing layer-based adjustment storage (base, prop-specific, combination)
 * - Cascading lookup for current adjustment values
 * - Resetting adjustments to default
 *
 * This service encapsulates the business logic previously embedded in ArrowAdjustmentPanel,
 * making it testable and reusable.
 */

import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/**
 * Arrow selection context for adjustment operations
 */
export interface SelectedArrowContext {
  motionData: MotionData;
  pictographData: PictographData;
  color: MotionColor | string;
}

/**
 * Result of applying a WASD movement
 */
export interface ApplyMovementResult {
  /** The key used for saving (for auto-save scheduling) */
  targetKey: AdjustmentTargetKey;
  /** New X adjustment value */
  newX: number;
  /** New Y adjustment value */
  newY: number;
  /** Whether the operation succeeded */
  success: boolean;
}

/**
 * Target key for adjustment storage
 */
export interface AdjustmentTargetKey {
  gridMode: string;
  oriKey: string;
  letter: string;
  turnsTuple: string;
  arrowKey: string;
  propType?: string;
}

/**
 * Result of looking up current adjustment via cascading
 */
export interface CascadingLookupResult {
  adjustment: { x: number; y: number };
  layer: 1 | 2 | 3 | null;
}

export interface IArrowAdjustmentOrchestrator {
  /**
   * Apply a WASD movement to the selected arrow.
   * Handles coordinate transformation, layer selection, and local repo save.
   *
   * @param key - WASD key pressed
   * @param increment - Pixel increment (5, 20, or 200)
   * @param selectedArrow - Context of the selected arrow
   * @param thisPropType - Prop type of the selected arrow
   * @param otherPropType - Prop type of the other hand's arrow
   * @returns Result containing the target key and new values
   */
  applyWASDMovement(
    key: "w" | "a" | "s" | "d",
    increment: number,
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    otherPropType: string
  ): Promise<ApplyMovementResult>;

  /**
   * Reset the selected arrow's adjustment to default.
   * Deletes from local cache and triggers re-render.
   *
   * @param selectedArrow - Context of the selected arrow
   * @param thisPropType - Prop type of the selected arrow
   * @param currentLayer - Layer where current adjustment was found (or default layer)
   * @returns The key that was deleted (for Firestore cleanup)
   */
  resetToDefault(
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    currentLayer: 1 | 2 | 3
  ): AdjustmentTargetKey | null;

  /**
   * Get the current adjustment for an arrow via cascading lookup.
   *
   * @param selectedArrow - Context of the selected arrow
   * @param thisPropType - Prop type of the selected arrow
   * @param otherPropType - Prop type of the other hand's arrow
   * @returns Cascading lookup result with adjustment and source layer
   */
  getCurrentAdjustment(
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    otherPropType: string
  ): CascadingLookupResult | null;

  /**
   * Determine the default save layer based on prop types.
   * - Both staff: Layer 1 (base)
   * - Same non-staff: Layer 2 (prop-specific)
   * - Different props: Layer 2 (prop-specific)
   */
  getDefaultSaveLayer(thisPropType: string, otherPropType: string): 1 | 2 | 3;

  /**
   * Generate the target key for a given arrow and layer.
   */
  generateTargetKey(
    selectedArrow: SelectedArrowContext,
    layer: 1 | 2 | 3,
    thisPropType: string
  ): AdjustmentTargetKey | null;
}
