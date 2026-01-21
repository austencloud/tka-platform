/**
 * ArrowAdjustmentOrchestrator
 *
 * Orchestrates arrow adjustment operations including coordinate transformation,
 * layer-based storage, cascading lookup, and cache invalidation.
 *
 * Extracted from ArrowAdjustmentPanel.svelte to make business logic testable.
 */

import { Point } from "fabric";
import type {
  IArrowAdjustmentOrchestrator,
  SelectedArrowContext,
  ApplyMovementResult,
  AdjustmentTargetKey,
  CascadingLookupResult,
} from "../contracts/IArrowAdjustmentOrchestrator";
import type { IKeyboardArrowAdjuster } from "../contracts/IKeyboardArrowAdjuster";
import type { IScreenSpaceAdjustmentTransformer } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IScreenSpaceAdjustmentTransformer";
import type { IArrowAdjustmentCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowAdjustmentCalculator";
import type { IArrowLocationCalculator } from "$lib/shared/pictograph/arrow/positioning/calculation/services/contracts/IArrowLocationCalculator";
import type { IGridModeDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridModeDeriver";
import type { ITurnsTupleGenerator } from "$lib/shared/pictograph/arrow/positioning/placement/services/contracts/ITurnsTupleGenerator";
import type { IPictographPreparer } from "$lib/shared/pictograph/shared/services/contracts/IPictographPreparer";
import { GlobalAdjustmentKeyGenerator } from "$lib/shared/pictograph/arrow/positioning/global/services/implementations/GlobalAdjustmentKeyGenerator";
import { getGlobalAdjustmentRepository } from "$lib/shared/pictograph/arrow/positioning/global/services/global-adjustment-singleton";
import { globalAdjustmentVersion } from "$lib/shared/pictograph/arrow/positioning/global/state/global-adjustment-version.svelte";
import type { GlobalArrowAdjustmentInput } from "$lib/shared/pictograph/arrow/positioning/global/domain/GlobalArrowAdjustment";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const logger = createComponentLogger("ArrowAdjustmentOrchestrator");

export class ArrowAdjustmentOrchestrator implements IArrowAdjustmentOrchestrator {
  private keyGenerator: GlobalAdjustmentKeyGenerator;

  constructor(
    private keyboardAdjuster: IKeyboardArrowAdjuster,
    private screenSpaceTransformer: IScreenSpaceAdjustmentTransformer,
    private arrowAdjustmentCalculator: IArrowAdjustmentCalculator,
    private arrowLocationCalculator: IArrowLocationCalculator,
    private pictographPreparer: IPictographPreparer,
    gridModeDeriver: IGridModeDeriver,
    turnsTupleGenerator: ITurnsTupleGenerator
  ) {
    this.keyGenerator = new GlobalAdjustmentKeyGenerator(gridModeDeriver, turnsTupleGenerator);
  }

  getDefaultSaveLayer(thisPropType: string, otherPropType: string): 1 | 2 | 3 {
    if (thisPropType === "staff" && otherPropType === "staff") {
      return 1; // Base layer for staff
    }
    return 2; // Prop-specific layer for non-staff
  }

  generateTargetKey(
    selectedArrow: SelectedArrowContext,
    layer: 1 | 2 | 3,
    thisPropType: string
  ): AdjustmentTargetKey | null {
    const keyOptions = layer === 1
      ? undefined // Layer 1: no prop types
      : { propType: thisPropType }; // Layer 2/3: include this prop's type

    return this.keyGenerator.generateKey(
      selectedArrow.motionData,
      selectedArrow.pictographData,
      selectedArrow.color as MotionColor,
      keyOptions
    );
  }

  getCurrentAdjustment(
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    otherPropType: string
  ): CascadingLookupResult | null {
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return null;

    // Generate BASE key (layer 1) for cascading lookup
    const baseKey = this.keyGenerator.generateKey(
      selectedArrow.motionData,
      selectedArrow.pictographData,
      selectedArrow.color as MotionColor
    );

    // Use cascading lookup to find adjustment at any layer
    return repo.getAdjustmentCascading(baseKey, thisPropType, otherPropType);
  }

  async applyWASDMovement(
    key: "w" | "a" | "s" | "d",
    increment: number,
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    otherPropType: string
  ): Promise<ApplyMovementResult> {
    const repo = getGlobalAdjustmentRepository();
    if (!repo) {
      return { targetKey: {} as AdjustmentTargetKey, newX: 0, newY: 0, success: false };
    }

    const { motionData, pictographData, color } = selectedArrow;
    const arrowColor = color as MotionColor;

    // Calculate WASD direction (screen space - what user wants to see)
    const screenSpaceAdjustment = this.keyboardAdjuster.calculateAdjustment(key, increment);

    // Calculate the arrow location properly
    // The motionData.arrowLocation often defaults to NORTH when not explicitly set,
    // which breaks the transformation for different pictograph variants.
    const arrowLocation = this.arrowLocationCalculator.calculateLocation(motionData, pictographData);

    // Transform screen-space adjustment to reference value using the INVERSE transformation.
    // This ensures that pressing W (up) on ANY variant moves the arrow UP on that variant's screen.
    const referenceAdjustment = this.screenSpaceTransformer.transformToReference(
      new Point(screenSpaceAdjustment.x, screenSpaceAdjustment.y),
      motionData,
      arrowLocation
    );

    // Determine save layer and build target key
    const defaultLayer = this.getDefaultSaveLayer(thisPropType, otherPropType);
    const targetKey = this.generateTargetKey(selectedArrow, defaultLayer, thisPropType);

    if (!targetKey) {
      return { targetKey: {} as AdjustmentTargetKey, newX: 0, newY: 0, success: false };
    }

    // Get current value via cascading lookup or calculator fallback
    const { currentX, currentY } = await this.getCurrentBaseValue(
      targetKey,
      selectedArrow,
      thisPropType,
      otherPropType,
      arrowColor
    );

    // Calculate new total using reference-transformed adjustment
    const newX = currentX + referenceAdjustment.x;
    const newY = currentY + referenceAdjustment.y;

    // Save to global repo locally (NOT to Firestore yet)
    try {
      const input: GlobalArrowAdjustmentInput = {
        ...targetKey,
        adjustmentX: newX,
        adjustmentY: newY,
      };
      repo.saveAdjustmentLocal(input);

      // Clear the pictograph preparation cache so ALL pictographs re-calculate
      this.pictographPreparer.clearCache();

      // Increment version to trigger reactive re-renders
      globalAdjustmentVersion.increment();

      return { targetKey, newX, newY, success: true };
    } catch (error) {
      logger.warn("Failed to save local adjustment:", error);
      return { targetKey, newX: 0, newY: 0, success: false };
    }
  }

  resetToDefault(
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    currentLayer: 1 | 2 | 3
  ): AdjustmentTargetKey | null {
    const repo = getGlobalAdjustmentRepository();
    if (!repo) return null;

    const targetKey = this.generateTargetKey(selectedArrow, currentLayer, thisPropType);
    if (!targetKey) return null;

    try {
      logger.log(`Deleting from Layer ${currentLayer} (${thisPropType})`);

      // Delete from local cache only (not Firestore - caller handles that)
      repo.deleteAdjustmentLocal(targetKey);

      // Clear the pictograph preparation cache
      this.pictographPreparer.clearCache();

      // Increment version to trigger reactive re-renders
      globalAdjustmentVersion.increment();

      return targetKey;
    } catch (error) {
      logger.warn("Failed to delete local adjustment:", error);
      return null;
    }
  }

  /**
   * Get the current base value for an adjustment, checking global repo first,
   * then falling back to cascading lookup or calculator.
   */
  private async getCurrentBaseValue(
    targetKey: AdjustmentTargetKey,
    selectedArrow: SelectedArrowContext,
    thisPropType: string,
    otherPropType: string,
    arrowColor: MotionColor
  ): Promise<{ currentX: number; currentY: number }> {
    const repo = getGlobalAdjustmentRepository();
    if (!repo) {
      return { currentX: 0, currentY: 0 };
    }

    // Check global repo at the target layer first
    const currentAdjustmentAtLayer = repo.getAdjustment(targetKey);
    if (currentAdjustmentAtLayer) {
      return { currentX: currentAdjustmentAtLayer.x, currentY: currentAdjustmentAtLayer.y };
    }

    // No global adjustment - try cascading lookup
    const { motionData, pictographData } = selectedArrow;
    const baseKey = this.keyGenerator.generateKey(motionData, pictographData, arrowColor);
    const cascadingResult = repo.getAdjustmentCascading(baseKey, thisPropType, otherPropType);

    if (cascadingResult) {
      return { currentX: cascadingResult.adjustment.x, currentY: cascadingResult.adjustment.y };
    }

    // No global at any layer - use the calculator (same path as rendering)
    try {
      const baseAdjustment = await this.arrowAdjustmentCalculator.getBaseAdjustmentPublic(
        pictographData,
        motionData,
        pictographData.letter || "",
        arrowColor
      );
      return { currentX: baseAdjustment.x, currentY: baseAdjustment.y };
    } catch (error) {
      logger.warn("Failed to get base adjustment, using (0, 0):", error);
      return { currentX: 0, currentY: 0 };
    }
  }
}
