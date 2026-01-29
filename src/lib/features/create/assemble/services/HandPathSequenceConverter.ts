/**
 * Hand Path Sequence Converter
 *
 * Converts hand paths (arrays of grid positions) into MotionData sequences
 * and merges blue/red hand paths into dual-prop PictographData sequences.
 */

import type {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
  HandMotionType,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";
import { createMotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import { createPictographData } from "$lib/shared/pictograph/shared/domain/factories/createPictographData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import { HandPathMotionCalculator } from "./HandPathMotionCalculator";

export class HandPathSequenceConverter {
  private calculator: HandPathMotionCalculator;

  constructor() {
    this.calculator = new HandPathMotionCalculator();
  }

  /**
   * Convert a hand path to a sequence of MotionData
   * IMPORTANT: Always uses PropType.HAND regardless of user settings
   * @param handPath - Array of grid locations representing the hand's path
   * @param color - Blue or Red
   * @param userSelectedRotation - The rotation direction the user selected for SHIFT motions
   * @param gridMode - Diamond or Box mode
   * @param forPreview - If true, uses FLOAT for all shift motions (no rotation implied yet)
   */
  convertHandPathToMotions(
    handPath: GridLocation[],
    color: MotionColor,
    userSelectedRotation: RotationDirection,
    gridMode: GridMode,
    forPreview: boolean = false
  ): MotionData[] {
    if (handPath.length < 2) {
      throw new Error(
        "Hand path must have at least 2 positions (start and one move)"
      );
    }

    const motions: MotionData[] = [];
    // FORCE PropType.HAND for hand path assembly
    const propType = PropType.HAND;

    // Process each transition in the hand path
    for (let i = 0; i < handPath.length - 1; i++) {
      const from = handPath[i]!;
      const to = handPath[i + 1]!;

      const handMotionType = this.calculator.calculateMotionType(
        from,
        to,
        gridMode
      );
      // Calculate which direction the hand is traveling (CW or CCW around grid)
      const handPathDirection = this.calculator.calculateRotationDirection(
        from,
        to,
        gridMode
      );

      // For preview, use FLOAT arrows (straight arrows, no rotation implied)
      // For final sequence, calculate PRO/ANTI based on hand path vs prop rotation
      const motionType = forPreview
        ? this.convertHandMotionTypeForPreview(handMotionType)
        : this.convertHandMotionTypeToMotionType(
            handMotionType,
            handPathDirection,
            userSelectedRotation
          );

      const rotationDirection = forPreview
        ? RotationDirection.NO_ROTATION
        : this.getRotationDirection(handMotionType, userSelectedRotation);

      const motion = createMotionData({
        color,
        startLocation: from,
        endLocation: to,
        motionType,
        rotationDirection,
        gridMode,
        propType,
        startOrientation: Orientation.IN,
        endOrientation: Orientation.IN,
        // FLOAT motions use "fl" for turns, others use 0
        turns: motionType === MotionType.FLOAT ? "fl" : 0,
        arrowLocation: from, // Will be calculated by arrow services
        isVisible: true,
      });

      motions.push(motion);
    }

    return motions;
  }

  /**
   * Convert HandMotionType to MotionType for preview (always uses FLOAT for shifts)
   */
  private convertHandMotionTypeForPreview(handMotionType: HandMotionType): MotionType {
    switch (handMotionType) {
      case HandMotionType.STATIC:
        return MotionType.STATIC;
      case HandMotionType.DASH:
        return MotionType.DASH;
      case HandMotionType.SHIFT:
        // Preview uses FLOAT - straight arrows with no rotation implied
        return MotionType.FLOAT;
      default:
        throw new Error(`Unknown HandMotionType: ${handMotionType}`);
    }
  }

  /**
   * Convert HandMotionType to MotionType
   * For SHIFT motions, requires comparing hand path direction to prop rotation direction
   */
  private convertHandMotionTypeToMotionType(
    handMotionType: HandMotionType,
    handPathDirection: RotationDirection | null,
    userSelectedPropRotation: RotationDirection
  ): MotionType {
    switch (handMotionType) {
      case HandMotionType.STATIC:
        return MotionType.STATIC;

      case HandMotionType.DASH:
        return MotionType.DASH;

      case HandMotionType.SHIFT:
        // PRO = prop rotation matches hand path direction
        // ANTI = prop rotation opposes hand path direction
        if (handPathDirection === userSelectedPropRotation) {
          return MotionType.PRO;
        } else {
          return MotionType.ANTI;
        }

      default:
        throw new Error(`Unknown HandMotionType: ${handMotionType}`);
    }
  }

  /**
   * Get the rotation direction for a motion
   */
  private getRotationDirection(
    handMotionType: HandMotionType,
    userSelectedRotation: RotationDirection
  ): RotationDirection {
    if (handMotionType === HandMotionType.SHIFT) {
      return userSelectedRotation;
    }
    return RotationDirection.NO_ROTATION;
  }

  /**
   * Create single-prop pictographs from hand path
   * IMPORTANT: Always uses PropType.HAND regardless of user settings
   * @param forPreview - If true, uses FLOAT arrows (no rotation implied)
   */
  convertHandPathToPictographs(
    handPath: GridLocation[],
    color: MotionColor,
    userSelectedRotation: RotationDirection,
    gridMode: GridMode,
    forPreview: boolean = false
  ): PictographData[] {
    const motions = this.convertHandPathToMotions(
      handPath,
      color,
      userSelectedRotation,
      gridMode,
      forPreview
    );

    return motions.map((motion) =>
      createPictographData({
        motions: {
          [color]: motion,
        },
      })
    );
  }

  /**
   * Merge blue and red hand paths into dual-prop pictograph sequence
   * IMPORTANT: Always uses PropType.HAND regardless of user settings
   * @param blueHandPath - Array of grid locations for blue hand
   * @param redHandPath - Array of grid locations for red hand
   * @param blueRotation - Prop rotation direction for blue hand
   * @param redRotation - Prop rotation direction for red hand
   * @param gridMode - Diamond or Box mode
   */
  mergeToDualPropSequence(
    blueHandPath: GridLocation[],
    redHandPath: GridLocation[],
    blueRotation: RotationDirection,
    redRotation: RotationDirection,
    gridMode: GridMode
  ): PictographData[] {
    // Both hands must have the same length
    if (blueHandPath.length !== redHandPath.length) {
      throw new Error(
        `Blue and red hand paths must be the same length. Blue: ${blueHandPath.length}, Red: ${redHandPath.length}`
      );
    }

    const blueMotions = this.convertHandPathToMotions(
      blueHandPath,
      MotionColor.BLUE,
      blueRotation,
      gridMode
    );

    const redMotions = this.convertHandPathToMotions(
      redHandPath,
      MotionColor.RED,
      redRotation,
      gridMode
    );

    // Merge into dual-prop pictographs (beat by beat)
    return blueMotions.map((blueMotion, index) => {
      const redMotion = redMotions[index];

      return createPictographData({
        motions: {
          [MotionColor.BLUE]: blueMotion,
          [MotionColor.RED]: redMotion,
        },
      });
    });
  }

  /**
   * Validate that a hand path is valid for the given grid mode
   */
  validateHandPath(handPath: GridLocation[], gridMode: GridMode): boolean {
    if (handPath.length < 2) {
      return false;
    }

    const activePositions = this.calculator.getActivePositions(gridMode);

    // Check all positions are valid for the grid mode
    for (const position of handPath) {
      if (!activePositions.includes(position)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Apply user's prop types to a finalized sequence
   * Called after rotation selection to convert from HAND to user's preferred props
   * @param sequence - The finalized sequence with PropType.HAND
   * @param bluePropType - User's selected prop type for blue hand
   * @param redPropType - User's selected prop type for red hand
   */
  applyUserPropTypes(
    sequence: PictographData[],
    bluePropType: PropType,
    redPropType: PropType
  ): PictographData[] {
    return sequence.map((pictograph) => {
      const newMotions: Partial<Record<MotionColor, MotionData>> = {};

      if (pictograph.motions.blue) {
        newMotions.blue = {
          ...pictograph.motions.blue,
          propType: bluePropType,
        };
      }

      if (pictograph.motions.red) {
        newMotions.red = {
          ...pictograph.motions.red,
          propType: redPropType,
        };
      }

      return createPictographData({
        ...pictograph,
        motions: newMotions,
      });
    });
  }
}
