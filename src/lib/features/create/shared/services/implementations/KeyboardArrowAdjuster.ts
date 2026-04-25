/**
 * Keyboard Arrow Adjustment Service Implementation
 *
 * Handles manual arrow position adjustments via WASD keyboard controls.
 * Applies adjustments to step data and triggers pictograph updates.
 *
 * Manual adjustments are stored and applied in SCREEN-SPACE:
 * - W = up on screen (0, -increment)
 * - A = left on screen (-increment, 0)
 * - S = down on screen (0, +increment)
 * - D = right on screen (+increment, 0)
 *
 * The adjustments are NOT transformed because the user expects screen-space
 * movement to match their input directly. The global adjustment system uses
 * a composite key (motion type, rotation, location, etc.) to apply the same
 * adjustment to all arrows with matching characteristics.
 *
 * Mirrors legacy desktop app functionality from:
 * legacy\src\main_window\main_widget\sequence_workbench\graph_editor\hotkey_graph_adjuster\arrow_movement_manager.py
 */

import type { StepData } from "../../domain/models/StepData";
import type { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";
import {
  createMotionData,
  type MotionData,
} from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createArrowPlacementData } from "$lib/shared/pictograph/arrow/positioning/placement/domain/createArrowPlacementData";
import type { IKeyboardArrowAdjuster } from "../contracts/IKeyboardArrowAdjuster";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export class KeyboardArrowAdjuster implements IKeyboardArrowAdjuster {
  private logger = createComponentLogger("KeyboardArrowAdjustment");

  /**
   * Calculate adjustment vector based on WASD key
   * Matches legacy logic from arrow_movement_manager.py lines 50-58
   */
  calculateAdjustment(
    key: "w" | "a" | "s" | "d",
    increment: number
  ): { x: number; y: number } {
    const directionMap: Record<string, { x: number; y: number }> = {
      w: { x: 0, y: -increment }, // Up
      a: { x: -increment, y: 0 }, // Left
      s: { x: 0, y: increment }, // Down
      d: { x: increment, y: 0 }, // Right
    };

    return directionMap[key] || { x: 0, y: 0 };
  }

  /**
   * Handle WASD movement for the currently selected arrow
   *
   * Legacy flow (lines 24-48 in arrow_movement_manager.py):
   * 1. Calculate adjustment based on key + modifiers
   * 2. Update special placement JSON with the adjustment
   * 3. Reload all pictographs with that letter
   *
   * Modern flow (web app):
   * 1. Calculate screen-space adjustment based on key + increment
   * 2. Store screen-space value directly (no transformation)
   * 3. Return updated step data to trigger re-render
   *
   * Adjustments are stored in screen-space because:
   * - User expects W to always move UP on their screen
   * - The global adjustment key includes motion characteristics (type, rotation, location)
   * - Same adjustments apply to arrows with matching characteristics
   */
  handleWASDMovement(
    key: "w" | "a" | "s" | "d",
    increment: number,
    selectedArrow: {
      motionData: MotionData;
      color: string;
      pictographData: PictographData;
    },
    stepData: StepData
  ): StepData {
    // Calculate screen-space adjustment (W = up on screen, etc.)
    const adjustment = this.calculateAdjustment(key, increment);

    this.logger.log(
      `🎯 WASD adjustment: ${key} → (${adjustment.x}, ${adjustment.y})px for ${selectedArrow.color} arrow`
    );

    // Get the current motion data for the selected arrow
    const currentMotion = stepData.motions[selectedArrow.color as MotionColor];
    if (!currentMotion) {
      this.logger.warn(`No motion data found for ${selectedArrow.color} arrow`);
      return stepData;
    }

    // Get current manual adjustments (or default to 0)
    const currentAdjustX =
      currentMotion.arrowPlacementData.manualAdjustmentX ?? 0;
    const currentAdjustY =
      currentMotion.arrowPlacementData.manualAdjustmentY ?? 0;

    // Add the new adjustment to the existing manual adjustments
    // Store in screen-space - user expects W = up, D = right, etc.
    const newAdjustX = currentAdjustX + adjustment.x;
    const newAdjustY = currentAdjustY + adjustment.y;

    this.logger.log(
      `  Previous adjustment: (${currentAdjustX}, ${currentAdjustY})`
    );
    this.logger.log(`  New total adjustment: (${newAdjustX}, ${newAdjustY})`);

    // Create updated arrow placement data with new manual adjustments
    const updatedArrowPlacementData = createArrowPlacementData({
      ...currentMotion.arrowPlacementData,
      manualAdjustmentX: newAdjustX,
      manualAdjustmentY: newAdjustY,
    });

    // Create updated motion data with new arrow placement data
    const updatedMotion = createMotionData({
      ...currentMotion,
      arrowPlacementData: updatedArrowPlacementData,
    });

    // Create updated step data with the modified motion
    const updatedStepData: StepData = {
      ...stepData,
      motions: {
        ...stepData.motions,
        [selectedArrow.color]: updatedMotion,
      },
    };

    this.logger.success(
      `✅ Applied manual adjustment to ${selectedArrow.color} arrow`
    );

    return updatedStepData;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const keyboardArrowAdjuster = new KeyboardArrowAdjuster();
