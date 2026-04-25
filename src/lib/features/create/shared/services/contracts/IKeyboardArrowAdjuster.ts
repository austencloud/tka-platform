/**
 * Keyboard Arrow Adjustment Service Contract
 *
 * Handles manual arrow position adjustments via WASD keyboard controls.
 * Applies adjustments to step data and updates the pictograph.
 */

import type { StepData } from "../../domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

export interface IKeyboardArrowAdjuster {
  /**
   * Handle WASD movement for the currently selected arrow
   * @param key - The WASD key pressed
   * @param increment - The pixel increment to move (5, 20, or 200)
   * @param selectedArrow - The currently selected arrow data
   * @param stepData - The step data to update
   * @returns Updated step data with arrow adjustment applied
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
  ): StepData;

  /**
   * Calculate adjustment vector based on key direction
   * @param key - The WASD key pressed
   * @param increment - The pixel increment
   * @returns Adjustment coordinates {x, y}
   */
  calculateAdjustment(
    key: "w" | "a" | "s" | "d",
    increment: number
  ): { x: number; y: number };
}
