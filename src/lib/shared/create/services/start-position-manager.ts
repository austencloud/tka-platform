import type {
  GridMode,
  GridLocation,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { StepData } from "$lib/shared/foundation/domain/models/step-data";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { Letter } from "$lib/shared/foundation/domain/models/letter";
import {
  MotionType,
  MotionColor,
  Orientation,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/prop-type";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/create-pictograph-data";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { getGridLocationsFromPosition } from "$lib/shared/pictograph/grid/services/grid-position-deriver";

export class StartPositionManager {

  async getStartPositions(gridMode: GridMode, blueOrientation?: Orientation, redOrientation?: Orientation): Promise<PictographData[]> {
    return this.getDefaultStartPositions(gridMode, blueOrientation, redOrientation);
  }

  getDefaultStartPositions(gridMode: GridMode, blueOrientation?: Orientation, redOrientation?: Orientation): PictographData[] {
    // Define start position locations based on grid mode
    const startPositionKeys =
      gridMode === "diamond"
        ? [
            { position: GridPosition.ALPHA1, letter: Letter.ALPHA },
            { position: GridPosition.BETA5, letter: Letter.BETA },
            { position: GridPosition.GAMMA11, letter: Letter.GAMMA },
          ]
        : [
            { position: GridPosition.ALPHA2, letter: Letter.ALPHA },
            { position: GridPosition.BETA6, letter: Letter.BETA },
            { position: GridPosition.GAMMA12, letter: Letter.GAMMA },
          ];

    return this.createPictographsFromPositions(startPositionKeys, gridMode, blueOrientation, redOrientation);
  }

  getAllStartPositionVariations(gridMode: GridMode, blueOrientation?: Orientation, redOrientation?: Orientation): PictographData[] {
    // Get all 16 start position variations for the specified grid mode
    // Based on legacy advanced start position picker
    const allVariations =
      gridMode === "diamond"
        ? [
            // Diamond mode: 16 positions (alpha1/3/5/7, beta1/3/5/7, gamma1/3/5/7/9/11/13/15)
            { position: GridPosition.ALPHA1, letter: Letter.ALPHA },
            { position: GridPosition.ALPHA3, letter: Letter.ALPHA },
            { position: GridPosition.ALPHA5, letter: Letter.ALPHA },
            { position: GridPosition.ALPHA7, letter: Letter.ALPHA },
            { position: GridPosition.BETA1, letter: Letter.BETA },
            { position: GridPosition.BETA3, letter: Letter.BETA },
            { position: GridPosition.BETA5, letter: Letter.BETA },
            { position: GridPosition.BETA7, letter: Letter.BETA },
            { position: GridPosition.GAMMA1, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA3, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA5, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA7, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA9, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA11, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA13, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA15, letter: Letter.GAMMA },
          ]
        : [
            // Box mode: 16 positions (alpha2/4/6/8, beta2/4/6/8, gamma2/4/6/8/10/12/14/16)
            { position: GridPosition.ALPHA2, letter: Letter.ALPHA },
            { position: GridPosition.ALPHA4, letter: Letter.ALPHA },
            { position: GridPosition.ALPHA6, letter: Letter.ALPHA },
            { position: GridPosition.ALPHA8, letter: Letter.ALPHA },
            { position: GridPosition.BETA2, letter: Letter.BETA },
            { position: GridPosition.BETA4, letter: Letter.BETA },
            { position: GridPosition.BETA6, letter: Letter.BETA },
            { position: GridPosition.BETA8, letter: Letter.BETA },
            { position: GridPosition.GAMMA2, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA4, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA6, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA8, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA10, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA12, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA14, letter: Letter.GAMMA },
            { position: GridPosition.GAMMA16, letter: Letter.GAMMA },
          ];

    return this.createPictographsFromPositions(allVariations, gridMode, blueOrientation, redOrientation);
  }

  private createPictographsFromPositions(
    positions: Array<{ position: GridPosition; letter: Letter }>,
    gridMode: GridMode,
    blueOrientation: Orientation = Orientation.IN,
    redOrientation: Orientation = Orientation.IN
  ): PictographData[] {
    return positions.map((pos, index) => {
      // Get the hand locations for this position (blue and red hand locations)
      const [blueLocation, redLocation] = this.getHandLocationsForPosition(
        pos.position
      );

      // Create proper motion data using factory functions (like the original working implementation)
      const blueMotion = createMotionData({
        motionType: MotionType.STATIC,
        startLocation: blueLocation,
        endLocation: blueLocation, // Start positions: start === end
        startOrientation: blueOrientation,
        endOrientation: blueOrientation,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.BLUE,
        isVisible: true,
        propType: PropType.STAFF,
        arrowLocation: blueLocation,
        gridMode, // Pass the grid mode for correct arrow positioning
      });

      const redMotion = createMotionData({
        motionType: MotionType.STATIC,
        startLocation: redLocation,
        endLocation: redLocation, // Start positions: start === end
        startOrientation: redOrientation,
        endOrientation: redOrientation,
        rotationDirection: RotationDirection.NO_ROTATION,
        turns: 0,
        color: MotionColor.RED,
        isVisible: true,
        propType: PropType.STAFF,
        arrowLocation: redLocation,
        gridMode, // Pass the grid mode for correct arrow positioning
      });

      // Create proper pictograph data using factory function (like the original working implementation)
      // Note: gridMode is stored in the motion data, not the pictograph itself
      return createPictographData({
        id: `start-pos-${index}`, // Stable across grid modes so components animate in-place
        letter: pos.letter,
        startPosition: pos.position,
        endPosition: pos.position,
        motions: {
          [MotionColor.BLUE]: blueMotion,
          [MotionColor.RED]: redMotion,
        },
      });
    });
  }

  private getHandLocationsForPosition(
    position: GridPosition
  ): [GridLocation, GridLocation] {
    // Use the canonical deriver to get hand locations for any position
    return getGridLocationsFromPosition(position);
  }

  selectStartPosition(position: PictographData): void {
    try {
      const startPosCopy = { ...position, isStartPosition: true };
      localStorage.setItem("startPosition", JSON.stringify(startPosCopy));
    } catch (error) {
      console.warn(
        "StartPositionManager: unable to persist start position selection",
        error
      );
    }
  }

  setStartPosition(startPosition: StepData): void {
    try {
      // Store the start position for the sequence
      localStorage.setItem(
        "sequenceStartPosition",
        JSON.stringify(startPosition)
      );
    } catch (error) {
      console.error("Error setting start position:", error);
      throw new Error(
        `Failed to set start position: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const startPositionManager = new StartPositionManager();
