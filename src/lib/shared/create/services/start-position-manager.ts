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
import {
  getGridLocationsFromPosition,
  getGridPositionFromLocations,
} from "$lib/shared/pictograph/grid/services/grid-position-deriver";

export interface StartPositionPlacement {
  blueLocation: GridLocation;
  redLocation: GridLocation;
  gridMode: GridMode;
  blueOrientation?: Orientation;
  redOrientation?: Orientation;
  bluePropType?: PropType;
  redPropType?: PropType;
  id?: string;
}

export class StartPositionManager {
  async getStartPositions(
    gridMode: GridMode,
    blueOrientation?: Orientation,
    redOrientation?: Orientation
  ): Promise<PictographData[]> {
    return this.getDefaultStartPositions(
      gridMode,
      blueOrientation,
      redOrientation
    );
  }

  getDefaultStartPositions(
    gridMode: GridMode,
    blueOrientation?: Orientation,
    redOrientation?: Orientation
  ): PictographData[] {
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

    return this.createPictographsFromPositions(
      startPositionKeys,
      gridMode,
      blueOrientation,
      redOrientation
    );
  }

  getAllStartPositionVariations(
    gridMode: GridMode,
    blueOrientation?: Orientation,
    redOrientation?: Orientation
  ): PictographData[] {
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

    return this.createPictographsFromPositions(
      allVariations,
      gridMode,
      blueOrientation,
      redOrientation
    );
  }

  private createPictographsFromPositions(
    positions: Array<{ position: GridPosition; letter: Letter }>,
    gridMode: GridMode,
    blueOrientation: Orientation = Orientation.IN,
    redOrientation: Orientation = Orientation.IN
  ): PictographData[] {
    return positions.map((pos, index) =>
      this.createStartPosition({
        position: pos.position,
        letter: pos.letter,
        gridMode,
        blueOrientation,
        redOrientation,
        id: `start-pos-${index}`,
      })
    );
  }

  /**
   * Create the same canonical start pictograph used by presets from two direct
   * placements. This keeps Build a pose out of the sequence data layer.
   */
  createStartPositionFromLocations(
    placement: StartPositionPlacement
  ): PictographData {
    const position = getGridPositionFromLocations(
      placement.blueLocation,
      placement.redLocation
    );

    return this.createStartPosition({
      position,
      letter: this.getStaticLetterForPosition(position),
      gridMode: placement.gridMode,
      blueOrientation: placement.blueOrientation,
      redOrientation: placement.redOrientation,
      bluePropType: placement.bluePropType,
      redPropType: placement.redPropType,
      id: placement.id ?? "start-built-pose",
    });
  }

  private createStartPosition({
    position,
    letter,
    gridMode,
    blueOrientation = Orientation.IN,
    redOrientation = Orientation.IN,
    bluePropType = PropType.STAFF,
    redPropType = PropType.STAFF,
    id = crypto.randomUUID(),
  }: {
    position: GridPosition;
    letter: Letter;
    gridMode: GridMode;
    blueOrientation?: Orientation;
    redOrientation?: Orientation;
    bluePropType?: PropType;
    redPropType?: PropType;
    id?: string;
  }): PictographData {
    const [blueLocation, redLocation] =
      this.getHandLocationsForPosition(position);

    const blueMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: blueLocation,
      endLocation: blueLocation,
      startOrientation: blueOrientation,
      endOrientation: blueOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.BLUE,
      isVisible: true,
      propType: bluePropType,
      arrowLocation: blueLocation,
      gridMode,
    });

    const redMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: redLocation,
      endLocation: redLocation,
      startOrientation: redOrientation,
      endOrientation: redOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      color: MotionColor.RED,
      isVisible: true,
      propType: redPropType,
      arrowLocation: redLocation,
      gridMode,
    });

    return createPictographData({
      id,
      letter,
      startPosition: position,
      endPosition: position,
      motions: {
        [MotionColor.BLUE]: blueMotion,
        [MotionColor.RED]: redMotion,
      },
    });
  }

  private getStaticLetterForPosition(position: GridPosition): Letter {
    if (position.startsWith("alpha")) return Letter.ALPHA;
    if (position.startsWith("beta")) return Letter.BETA;
    if (position.startsWith("gamma")) return Letter.GAMMA;
    if (position.startsWith("zeta")) return Letter.ZETA;
    if (position.startsWith("eta")) return Letter.ETA;

    throw new Error(`Unsupported Construct start position: ${position}`);
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
