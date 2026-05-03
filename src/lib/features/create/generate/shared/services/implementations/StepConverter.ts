/**
 * Beat Converter Service
 *
 * Handles conversion of PictographData to StepData and StartPositionData.
 * Single Responsibility: Transform pictograph data into proper domain objects.
 *
 * MIGRATION NOTE: Now properly distinguishes between steps and start positions.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import {
  MotionType,
  RotationDirection,
  Orientation,
  MotionColor,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { createStepData } from "$lib/features/create/shared/domain/factories/createStepData";
import { createStartPositionData } from "$lib/features/create/shared/domain/factories/createStartPositionData";

export class StepConverter {
  /**
   * Convert PictographData to StepData - creates proper domain object for steps
   *
   * @param pictograph - Source pictograph data
   * @param stepNumber - Beat number (should be >= 1, use convertToStartPosition for start position)
   * @param gridMode - Grid mode for the beat
   */
  convertToStep(
    pictograph: PictographData,
    stepNumber: number,
    gridMode: GridMode
  ): StepData {
    // MIGRATION NOTE: If stepNumber === 0, should use convertToStartPosition instead
    // But keep backward compatibility for now
    if (stepNumber === 0) {
      // Silently handle stepNumber 0 for backward compatibility
    }

    const motions = this.ensureMotionsWithGridMode(pictograph, gridMode);

    return createStepData({
      ...pictograph, // Spread PictographData properties
      stepNumber: stepNumber,
      duration: 1.0,
      blueReversal: false,
      redReversal: false,
      isBlank: false,
      motions, // Override motions with the enhanced version
    });
  }

  /**
   * Convert PictographData to StartPositionData - creates proper domain object for start positions
   *
   * @param pictograph - Source pictograph data
   * @param gridMode - Grid mode for the start position
   */
  convertToStartPosition(
    pictograph: PictographData,
    gridMode: GridMode
  ): StartPositionData {
    const motions = this.ensureMotionsWithGridMode(pictograph, gridMode);

    return createStartPositionData({
      ...pictograph, // Spread PictographData properties
      motions, // Override motions with the enhanced version
      gridPosition: pictograph.startPosition, // Use pictograph's startPosition as gridPosition
    });
  }

  /**
   * Ensure motions exist for both colors with proper defaults and gridMode
   * Shared helper for both beat and start position conversion
   */
  private ensureMotionsWithGridMode(
    pictograph: PictographData,
    gridMode: GridMode
  ): Record<string, MotionData> {
    // Create default motion for missing motion data
    const defaultMotion: MotionData = createMotionData({
      motionType: MotionType.STATIC,
      rotationDirection: RotationDirection.NO_ROTATION,
      startLocation: GridLocation.NORTH,
      endLocation: GridLocation.NORTH,
      turns: 0,
      startOrientation: Orientation.IN,
      endOrientation: Orientation.IN,
      gridMode: gridMode,
    });

    // Access motions using MotionColor enum values
    const blueMotion = pictograph.motions[MotionColor.BLUE];
    const redMotion = pictograph.motions[MotionColor.RED];

    return {
      [MotionColor.BLUE]: blueMotion
        ? { ...blueMotion, gridMode }
        : defaultMotion,
      [MotionColor.RED]: redMotion
        ? { ...redMotion, gridMode }
        : defaultMotion,
    };
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const stepConverter = new StepConverter();
