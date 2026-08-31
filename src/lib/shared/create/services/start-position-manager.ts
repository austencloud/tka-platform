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
  HandSide,
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
  leftLocation: GridLocation;
  rightLocation: GridLocation;
  gridMode: GridMode;
  leftOrientation?: Orientation;
  rightOrientation?: Orientation;
  leftPropType?: PropType;
  rightPropType?: PropType;
  id?: string;
}

export class StartPositionManager {
  async getStartPositions(
    gridMode: GridMode,
    leftOrientation?: Orientation,
    rightOrientation?: Orientation
  ): Promise<PictographData[]> {
    return this.getDefaultStartPositions(
      gridMode,
      leftOrientation,
      rightOrientation
    );
  }

  getDefaultStartPositions(
    gridMode: GridMode,
    leftOrientation?: Orientation,
    rightOrientation?: Orientation
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
      leftOrientation,
      rightOrientation
    );
  }

  getAllStartPositionVariations(
    gridMode: GridMode,
    leftOrientation?: Orientation,
    rightOrientation?: Orientation
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
      leftOrientation,
      rightOrientation
    );
  }

  private createPictographsFromPositions(
    positions: Array<{ position: GridPosition; letter: Letter }>,
    gridMode: GridMode,
    leftOrientation: Orientation = Orientation.IN,
    rightOrientation: Orientation = Orientation.IN
  ): PictographData[] {
    return positions.map((pos, index) =>
      this.createStartPosition({
        position: pos.position,
        letter: pos.letter,
        gridMode,
        leftOrientation,
        rightOrientation,
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
      placement.leftLocation,
      placement.rightLocation
    );

    return this.createStartPosition({
      position,
      letter: this.getStaticLetterForPosition(position),
      gridMode: placement.gridMode,
      leftOrientation: placement.leftOrientation,
      rightOrientation: placement.rightOrientation,
      leftPropType: placement.leftPropType,
      rightPropType: placement.rightPropType,
      id: placement.id ?? "start-built-pose",
    });
  }

  private createStartPosition({
    position,
    letter,
    gridMode,
    leftOrientation = Orientation.IN,
    rightOrientation = Orientation.IN,
    leftPropType = PropType.STAFF,
    rightPropType = PropType.STAFF,
    id = crypto.randomUUID(),
  }: {
    position: GridPosition;
    letter: Letter;
    gridMode: GridMode;
    leftOrientation?: Orientation;
    rightOrientation?: Orientation;
    leftPropType?: PropType;
    rightPropType?: PropType;
    id?: string;
  }): PictographData {
    const [leftLocation, rightLocation] =
      this.getHandLocationsForPosition(position);

    const leftMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: leftLocation,
      endLocation: leftLocation,
      startOrientation: leftOrientation,
      endOrientation: leftOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      hand: HandSide.LEFT,
      isVisible: true,
      propType: leftPropType,
      arrowLocation: leftLocation,
      gridMode,
    });

    const rightMotion = createMotionData({
      motionType: MotionType.STATIC,
      startLocation: rightLocation,
      endLocation: rightLocation,
      startOrientation: rightOrientation,
      endOrientation: rightOrientation,
      rotationDirection: RotationDirection.NO_ROTATION,
      turns: 0,
      hand: HandSide.RIGHT,
      isVisible: true,
      propType: rightPropType,
      arrowLocation: rightLocation,
      gridMode,
    });

    return createPictographData({
      id,
      letter,
      startPosition: position,
      endPosition: position,
      motions: {
        [HandSide.LEFT]: leftMotion,
        [HandSide.RIGHT]: rightMotion,
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
