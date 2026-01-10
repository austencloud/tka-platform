/**
 * Orientation Calculation Service - Complete port from legacy JsonOriCalculator
 *
 * Exact implementation of legacy orientation calculation algorithms including:
 * - Complete float orientation calculation with handpath direction
 * - Full turn orientation calculation for whole and half turns
 * - Exact motion type differentiation (PRO/STATIC vs ANTI/DASH)
 * - Complete handpath calculation for all location pairs
 */

import {
  HandPath,
  MotionColor,
  MotionType,
  Orientation,
  RotationDirection,
} from "../../../shared/domain/enums/pictograph-enums";
import {
  createMotionData,
  type MotionData,
} from "../../../shared/domain/models/MotionData";
import type { BeatData } from "../../../../../features/create/shared/domain/models/BeatData";
import type { StartPositionData } from "../../../../../features/create/shared/domain/models/StartPositionData";
import type { IOrientationCalculator } from "../contracts/IOrientationCalculator";
import { GridLocation } from "../../../grid/domain/enums/grid-enums";
import { PropType } from "../../domain/enums/PropType";

export class OrientationCalculator implements IOrientationCalculator {
  private handpathCalculator: HandpathCalculator;

  constructor() {
    this.handpathCalculator = new HandpathCalculator();
  }

  /**
   * Calculate end orientation - exact port from legacy calculate_end_ori()
   */
  calculateEndOrientation(
    motion: MotionData,
    _color: MotionColor
  ): Orientation {
    const motionType = motion.motionType;
    const turns = motion.turns;
    const startOrientation = motion.startOrientation;
    const propRotDir = motion.rotationDirection;
    const startLocation = motion.startLocation;
    const endLocation = motion.endLocation;

    let endOrientation: Orientation;

    if (motionType === MotionType.FLOAT) {
      const handpathDirection = this.handpathCalculator.getHandRotDir(
        startLocation,
        endLocation
      ) as HandPath;
      endOrientation = this.calculateFloatOrientation(
        startOrientation,
        handpathDirection
      );
    } else {
      endOrientation = this.calculateTurnOrientation(
        motionType,
        turns,
        startOrientation,
        propRotDir,
        startLocation,
        endLocation
      );
    }

    if (endOrientation === null || endOrientation === undefined) {
      throw new Error(
        "Calculated end orientation cannot be None. " +
          "Please check the input data and orientation calculator."
      );
    }

    return endOrientation;
  }

  /**
   * Calculate turn orientation - exact port from legacy
   */
  private calculateTurnOrientation(
    motionType: MotionType,
    turns: number | "fl",
    startOrientation: Orientation,
    propRotDir: RotationDirection,
    startLocation: GridLocation,
    endLocation: GridLocation
  ): Orientation {
    if (turns === 0 || turns === 1 || turns === 2 || turns === 3) {
      return this.calculateWholeTurnOrientation(
        motionType,
        turns as number,
        startOrientation,
        propRotDir
      );
    } else if (turns === "fl") {
      const handpathDirection = this.handpathCalculator.getHandRotDir(
        startLocation,
        endLocation
      ) as HandPath;
      return this.calculateFloatOrientation(
        startOrientation,
        handpathDirection
      );
    } else {
      return this.calculateHalfTurnOrientation(
        motionType,
        turns,
        startOrientation,
        propRotDir
      );
    }
  }

  /**
   * Calculate whole turn orientation - exact port from legacy
   */
  private calculateWholeTurnOrientation(
    motionType: MotionType,
    turns: number,
    startOrientation: Orientation,
    _propRotDir: RotationDirection
  ): Orientation {
    if (motionType === MotionType.PRO || motionType === MotionType.STATIC) {
      if (turns % 2 === 0) {
        return startOrientation;
      } else {
        return this.switchOrientation(startOrientation);
      }
    } else if (
      motionType === MotionType.ANTI ||
      motionType === MotionType.DASH
    ) {
      if (turns % 2 === 0) {
        return this.switchOrientation(startOrientation);
      } else {
        return startOrientation;
      }
    }
    return startOrientation;
  }

  /**
   * Calculate half turn orientation - exact port from legacy
   */
  private calculateHalfTurnOrientation(
    motionType: MotionType,
    turns: number,
    startOrientation: Orientation,
    propRotDir: RotationDirection
  ): Orientation {
    let orientationMap: Record<string, Orientation>;

    if (motionType === MotionType.ANTI || motionType === MotionType.DASH) {
      orientationMap = {
        [`${Orientation.IN}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.CLOCK : Orientation.COUNTER,
        [`${Orientation.IN}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.COUNTER : Orientation.CLOCK,
        [`${Orientation.OUT}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.COUNTER : Orientation.CLOCK,
        [`${Orientation.OUT}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.CLOCK : Orientation.COUNTER,
        [`${Orientation.CLOCK}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.OUT : Orientation.IN,
        [`${Orientation.CLOCK}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.IN : Orientation.OUT,
        [`${Orientation.COUNTER}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.IN : Orientation.OUT,
        [`${Orientation.COUNTER}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.OUT : Orientation.IN,
      };
    } else if (
      motionType === MotionType.PRO ||
      motionType === MotionType.STATIC
    ) {
      orientationMap = {
        [`${Orientation.IN}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.COUNTER : Orientation.CLOCK,
        [`${Orientation.IN}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.CLOCK : Orientation.COUNTER,
        [`${Orientation.OUT}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.CLOCK : Orientation.COUNTER,
        [`${Orientation.OUT}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.COUNTER : Orientation.CLOCK,
        [`${Orientation.CLOCK}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.IN : Orientation.OUT,
        [`${Orientation.CLOCK}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.OUT : Orientation.IN,
        [`${Orientation.COUNTER}_${RotationDirection.CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.OUT : Orientation.IN,
        [`${Orientation.COUNTER}_${RotationDirection.COUNTER_CLOCKWISE}`]:
          turns % 2 === 0.5 ? Orientation.IN : Orientation.OUT,
      };
    } else {
      return startOrientation;
    }

    const key = `${startOrientation}_${propRotDir}`;
    return orientationMap[key] || startOrientation;
  }

  /**
   * Calculate float orientation - exact port from legacy
   */
  private calculateFloatOrientation(
    startOrientation: Orientation,
    handpathDirection: HandPath
  ): Orientation {
    const orientationMap: Record<string, Orientation> = {
      [`${Orientation.IN}_${HandPath.CLOCKWISE}`]: Orientation.CLOCK,
      [`${Orientation.IN}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.COUNTER,
      [`${Orientation.OUT}_${HandPath.CLOCKWISE}`]: Orientation.COUNTER,
      [`${Orientation.OUT}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.CLOCK,
      [`${Orientation.CLOCK}_${HandPath.CLOCKWISE}`]: Orientation.OUT,
      [`${Orientation.CLOCK}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.IN,
      [`${Orientation.COUNTER}_${HandPath.CLOCKWISE}`]: Orientation.IN,
      [`${Orientation.COUNTER}_${HandPath.COUNTER_CLOCKWISE}`]: Orientation.OUT,
    };

    const key = `${startOrientation}_${handpathDirection}`;
    return orientationMap[key] || startOrientation;
  }

  /**
   * Switch orientation - exact port from legacy
   */
  private switchOrientation(ori: Orientation): Orientation {
    const switchMap: Record<string, Orientation> = {
      [Orientation.IN]: Orientation.OUT,
      [Orientation.OUT]: Orientation.IN,
      [Orientation.CLOCK]: Orientation.COUNTER,
      [Orientation.COUNTER]: Orientation.CLOCK,
    };
    return switchMap[ori] || ori;
  }

  /**
   * Update start orientations - returns updated beat data
   */
  updateStartOrientations(
    nextBeat: BeatData,
    lastBeat: BeatData | StartPositionData
  ): BeatData {
    if (nextBeat.isBlank || ("isBlank" in lastBeat && lastBeat.isBlank)) {
      throw new Error("Both beats must have motion data (not be blank)");
    }

    const lastBlueMotion = lastBeat.motions["blue"];
    const lastRedMotion = lastBeat.motions["red"];

    if (
      !lastBlueMotion ||
      !lastRedMotion ||
      !lastBlueMotion.endOrientation ||
      !lastRedMotion.endOrientation
    ) {
      throw new Error(
        "End orientations cannot be None. Ensure the previous beat has valid orientations."
      );
    }

    // Create updated motions with new start orientations
    const updatedMotions = { ...nextBeat.motions };

    if (updatedMotions.blue) {
      updatedMotions.blue = {
        ...updatedMotions.blue,
        startOrientation: lastBlueMotion.endOrientation,
      };
    }

    if (updatedMotions.red) {
      updatedMotions.red = {
        ...updatedMotions.red,
        startOrientation: lastRedMotion.endOrientation,
      };
    }

    // Return updated beat data
    return {
      ...nextBeat,
      motions: updatedMotions,
    };
  }

  /**
   * Update end orientations - returns updated beat data
   */
  updateEndOrientations(beat: BeatData): BeatData {
    if (beat.isBlank) {
      throw new Error("Beat must have motion data (not be blank)");
    }

    const updatedMotions = { ...beat.motions };

    // Calculate blue end orientation
    const blueMotion = beat.motions["blue"];
    if (blueMotion) {
      const blueMotionData: MotionData = createMotionData({
        motionType: blueMotion.motionType || MotionType.STATIC,
        rotationDirection:
          blueMotion.rotationDirection || RotationDirection.NO_ROTATION,
        startLocation: blueMotion.startLocation || GridLocation.NORTH,
        endLocation: blueMotion.endLocation || GridLocation.NORTH,
        turns: blueMotion.turns || 0,
        startOrientation: blueMotion.startOrientation || Orientation.IN,
        endOrientation: blueMotion.endOrientation || Orientation.IN,
        isVisible: blueMotion.isVisible ?? true,
        color: MotionColor.BLUE,
        propType: PropType.STAFF, // Default prop type
        arrowLocation: blueMotion.startLocation || GridLocation.NORTH, // Will be calculated
      });

      const calculatedEndOri = this.calculateEndOrientation(
        blueMotionData,
        MotionColor.BLUE
      );

      updatedMotions.blue = {
        ...blueMotion,
        endOrientation: calculatedEndOri,
      };
    }

    // Calculate red end orientation
    const redMotion = beat.motions["red"];
    if (redMotion) {
      const redMotionData: MotionData = createMotionData({
        motionType: redMotion.motionType || MotionType.STATIC,
        rotationDirection:
          redMotion.rotationDirection || RotationDirection.NO_ROTATION,
        startLocation: redMotion.startLocation || GridLocation.NORTH,
        endLocation: redMotion.endLocation || GridLocation.NORTH,
        turns: redMotion.turns || 0,
        startOrientation: redMotion.startOrientation || Orientation.IN,
        endOrientation: redMotion.endOrientation || Orientation.IN,
        isVisible: redMotion.isVisible ?? true,
        color: MotionColor.RED,
        propType: PropType.STAFF, // Default prop type
        arrowLocation: redMotion.startLocation || GridLocation.NORTH, // Will be calculated
      });

      const calculatedEndOri = this.calculateEndOrientation(
        redMotionData,
        MotionColor.RED
      );

      updatedMotions.red = {
        ...redMotion,
        endOrientation: calculatedEndOri,
      };
    }

    // Return updated beat data
    return {
      ...beat,
      motions: updatedMotions,
    };
  }
}

/**
 * Handpath Calculator - Exact port from legacy HandpathCalculator
 *
 * Calculates hand rotation direction based on start and end locations.
 * Complete mapping of all location pairs to handpath directions.
 */
class HandpathCalculator {
  private handRotDirMap: Map<string, string>;

  constructor() {
    // Exact pairs from legacy HandpathCalculator
    const clockwisePairs = [
      [GridLocation.SOUTH, GridLocation.WEST],
      [GridLocation.WEST, GridLocation.NORTH],
      [GridLocation.NORTH, GridLocation.EAST],
      [GridLocation.EAST, GridLocation.SOUTH],
    ];

    const counterClockwisePairs = [
      [GridLocation.WEST, GridLocation.SOUTH],
      [GridLocation.NORTH, GridLocation.WEST],
      [GridLocation.EAST, GridLocation.NORTH],
      [GridLocation.SOUTH, GridLocation.EAST],
    ];

    const diagonalClockwise = [
      [GridLocation.NORTHEAST, GridLocation.SOUTHEAST],
      [GridLocation.SOUTHEAST, GridLocation.SOUTHWEST],
      [GridLocation.SOUTHWEST, GridLocation.NORTHWEST],
      [GridLocation.NORTHWEST, GridLocation.NORTHEAST],
    ];

    const diagonalCounterClockwise = [
      [GridLocation.NORTHEAST, GridLocation.NORTHWEST],
      [GridLocation.NORTHWEST, GridLocation.SOUTHWEST],
      [GridLocation.SOUTHWEST, GridLocation.SOUTHEAST],
      [GridLocation.SOUTHEAST, GridLocation.NORTHEAST],
    ];

    const dashPairs = [
      [GridLocation.SOUTH, GridLocation.NORTH],
      [GridLocation.WEST, GridLocation.EAST],
      [GridLocation.NORTH, GridLocation.SOUTH],
      [GridLocation.EAST, GridLocation.WEST],
      [GridLocation.NORTHEAST, GridLocation.SOUTHWEST],
      [GridLocation.SOUTHEAST, GridLocation.NORTHWEST],
      [GridLocation.SOUTHWEST, GridLocation.NORTHEAST],
      [GridLocation.NORTHWEST, GridLocation.SOUTHEAST],
    ];

    const staticPairs = [
      [GridLocation.NORTH, GridLocation.NORTH],
      [GridLocation.EAST, GridLocation.EAST],
      [GridLocation.SOUTH, GridLocation.SOUTH],
      [GridLocation.WEST, GridLocation.WEST],
      [GridLocation.NORTHEAST, GridLocation.NORTHEAST],
      [GridLocation.SOUTHEAST, GridLocation.SOUTHEAST],
      [GridLocation.SOUTHWEST, GridLocation.SOUTHWEST],
      [GridLocation.NORTHWEST, GridLocation.NORTHWEST],
    ];

    // Build the complete map
    this.handRotDirMap = new Map();

    // Add all mappings
    clockwisePairs.concat(diagonalClockwise).forEach(([start, end]) => {
      this.handRotDirMap.set(`${start}_${end}`, HandPath.CLOCKWISE);
    });

    counterClockwisePairs
      .concat(diagonalCounterClockwise)
      .forEach(([start, end]) => {
        this.handRotDirMap.set(`${start}_${end}`, HandPath.COUNTER_CLOCKWISE);
      });

    dashPairs.forEach(([start, end]) => {
      this.handRotDirMap.set(`${start}_${end}`, HandPath.DASH);
    });

    staticPairs.forEach(([start, end]) => {
      this.handRotDirMap.set(`${start}_${end}`, HandPath.STATIC);
    });
  }

  /**
   * Get hand rotation direction - exact port from legacy
   */
  getHandRotDir(startLocation: string, endLocation: string): string {
    const key = `${startLocation}_${endLocation}`;
    return this.handRotDirMap.get(key) || "NO HAND ROTATION FOUND";
  }
}
