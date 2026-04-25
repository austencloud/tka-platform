/**
 * Start Position Deriver
 *
 * Derives/reconstructs start position data from the first beat of a sequence.
 * When sequences don't store explicit start positions, this service can
 * reconstruct them by examining the first beat's motion start locations.
 */

import type { IStartPositionDeriver } from "../contracts/IStartPositionDeriver";
import type { IGridPositionDeriver } from "$lib/shared/pictograph/grid/services/contracts/IGridPositionDeriver";
import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { StartPositionData } from "$lib/features/create/shared/domain/models/StartPositionData";
import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/createPictographData";
import {
  MotionType,
  MotionColor,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { Letter } from "$lib/shared/foundation/domain/models/Letter";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

export class StartPositionDeriver implements IStartPositionDeriver {
  constructor(private gridPositionDeriver: IGridPositionDeriver) {}

  deriveFromFirstBeat(firstStep: StepData): StartPositionData {
    const blueMotion = firstStep.motions?.[MotionColor.BLUE];
    const redMotion = firstStep.motions?.[MotionColor.RED];

    if (!blueMotion || !redMotion) {
      throw new Error(
        "Cannot derive start position: first beat missing blue or red motion"
      );
    }

    // Get the START locations from the first beat's motions
    const blueStartLocation = blueMotion.startLocation;
    const redStartLocation = redMotion.startLocation;

    // Derive the grid position from the two hand locations
    const gridPosition = this.gridPositionDeriver.getGridPositionFromLocations(
      blueStartLocation,
      redStartLocation
    );

    // Determine the letter from the grid position (alpha, beta, or gamma)
    const letter = this.getLetterFromGridPosition(gridPosition);

    // Get grid mode from the motion (they should all have the same grid mode)
    const gridMode = blueMotion.gridMode;

    // Create static motion data for the start position
    // Start positions have no movement - props are stationary at starting locations
    const blueStaticMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueStartLocation,
      endLocation: blueStartLocation, // Static: start === end
      startOrientation: blueMotion.startOrientation,
      endOrientation: blueMotion.startOrientation, // Static: orientation doesn't change
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: blueMotion.propType,
      arrowLocation: blueStartLocation,
      gridMode,
    });

    const redStaticMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redStartLocation,
      endLocation: redStartLocation, // Static: start === end
      startOrientation: redMotion.startOrientation,
      endOrientation: redMotion.startOrientation, // Static: orientation doesn't change
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redMotion.propType,
      arrowLocation: redStartLocation,
      gridMode,
    });

    // Create the start position pictograph data
    const pictographData = createPictographData({
      id: `derived-start-${gridPosition}`,
      letter,
      startPosition: gridPosition,
      endPosition: gridPosition,
      motions: {
        [MotionColor.BLUE]: blueStaticMotion,
        [MotionColor.RED]: redStaticMotion,
      },
    });

    // Return as StartPositionData with the discriminator
    return {
      ...pictographData,
      isStartPosition: true,
      gridPosition,
    } as StartPositionData;
  }

  getOrDeriveStartPosition(
    sequence: SequenceData
  ): StartPositionData | StepData | null {
    // Check for existing start position data first
    if (sequence.startPosition) {
      return sequence.startPosition;
    }

    if (sequence.startingPosition) {
      return sequence.startingPosition;
    }

    // No stored start position - derive from first beat
    const firstStep = sequence.steps?.[0];
    if (firstStep) {
      try {
        return this.deriveFromFirstBeat(firstStep);
      } catch (error) {
        console.warn("Failed to derive start position from first beat:", error);
        return null;
      }
    }

    return null;
  }

  /**
   * Map grid position to the corresponding Greek letter
   */
  private getLetterFromGridPosition(position: GridPosition): Letter {
    const positionStr = position.toString().toLowerCase();

    if (positionStr.startsWith("alpha")) {
      return Letter.ALPHA;
    }
    if (positionStr.startsWith("beta")) {
      return Letter.BETA;
    }
    if (positionStr.startsWith("gamma")) {
      return Letter.GAMMA;
    }

    // Fallback - shouldn't happen with valid positions
    console.warn(
      `Unknown grid position type: ${position}, defaulting to ALPHA`
    );
    return Letter.ALPHA;
  }
}

// ============================================================================
// DIRECT EXPORT - Use this instead of startPositionDeriver
// This avoids DI container rebuilds when this file changes
// ============================================================================
import { gridPositionDeriver } from "$lib/shared/pictograph/grid/services/implementations/GridPositionDeriver";

export const startPositionDeriver = new StartPositionDeriver(gridPositionDeriver);
