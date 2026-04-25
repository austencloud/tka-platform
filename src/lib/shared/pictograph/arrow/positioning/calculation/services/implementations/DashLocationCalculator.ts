/**
 * Dash Location Calculator Service
 *
 * Comprehensive dash location calculation logic with all special cases.
 * Direct TypeScript port of the Python DashLocationCalculator.
 *
 * This service implements:
 * - Φ_DASH and Ψ_DASH special handling
 * - Λ (Lambda) zero turns special case
 * - Type 3 scenario detection and handling
 * - Grid mode specific calculations (Diamond/Box)
 * - Complex location mappings for different scenarios
 */

import {
  GridLocation,
  GridMode,
} from "../../../../../grid/domain/enums/grid-enums";
import {
  getLetterType,
  Letter,
} from "../../../../../../foundation/domain/models/Letter";
import type { MotionData } from "../../../../../shared/domain/models/MotionData";
import type { PictographData } from "../../../../../shared/domain/models/PictographData";
import { ShiftLocationCalculator } from "./ShiftLocationCalculator";
import { LetterType } from "../../../../../../foundation/domain/models/LetterType";


// Arrow color type - using string literals to match usage pattern

export interface IDashLocationCalculator {
  calculateDashLocationFromPictographData(
    pictographData: PictographData,
    isBlueArrow: boolean
  ): GridLocation;
  calculateDashLocation(
    motion: MotionData,
    otherMotion?: MotionData,
    letterType?: LetterType,
    gridMode?: GridMode,
    shiftLocation?: GridLocation,
    isPhiDash?: boolean,
    isPsiDash?: boolean,
    isLambda?: boolean,
    isLambdaDash?: boolean
  ): GridLocation;
}

export class DashLocationCalculator implements IDashLocationCalculator {
  /**
   * Dash location calculation service.
   *
   * Implements comprehensive dash location calculation logic including:
   * - Φ_DASH and Ψ_DASH special handling
   * - Λ (Lambda) zero turns special case
   * - Type 3 scenario detection and handling
   * - Grid mode specific calculations (Diamond/Box)
   * - Complex location mappings for different scenarios
   */

  // Predefined location mappings for dash calculations - comprehensive mapping
  private readonly PHI_DASH_PSI_DASH_LOCATION_MAP: Record<
    string,
    GridLocation
  > = {
    [`red,${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.EAST,
    [`red,${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.NORTH,
    [`red,${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.EAST,
    [`red,${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.NORTH,
    [`blue,${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.WEST,
    [`blue,${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.SOUTH,
    [`blue,${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.WEST,
    [`blue,${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.SOUTH,
    [`red,${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]:
      GridLocation.NORTHEAST,
    [`red,${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]:
      GridLocation.SOUTHEAST,
    [`red,${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]:
      GridLocation.SOUTHEAST,
    [`red,${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]:
      GridLocation.NORTHEAST,
    [`blue,${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]:
      GridLocation.SOUTHWEST,
    [`blue,${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]:
      GridLocation.NORTHWEST,
    [`blue,${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]:
      GridLocation.NORTHWEST,
    [`blue,${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]:
      GridLocation.SOUTHWEST,
  };

  private readonly LAMBDA_ZERO_TURNS_LOCATION_MAP: Record<
    string,
    GridLocation
  > = {
    [`${GridLocation.NORTH},${GridLocation.SOUTH},${GridLocation.WEST}`]:
      GridLocation.EAST,
    [`${GridLocation.EAST},${GridLocation.WEST},${GridLocation.SOUTH}`]:
      GridLocation.NORTH,
    [`${GridLocation.NORTH},${GridLocation.SOUTH},${GridLocation.EAST}`]:
      GridLocation.WEST,
    [`${GridLocation.WEST},${GridLocation.EAST},${GridLocation.SOUTH}`]:
      GridLocation.NORTH,
    [`${GridLocation.SOUTH},${GridLocation.NORTH},${GridLocation.WEST}`]:
      GridLocation.EAST,
    [`${GridLocation.EAST},${GridLocation.WEST},${GridLocation.NORTH}`]:
      GridLocation.SOUTH,
    [`${GridLocation.SOUTH},${GridLocation.NORTH},${GridLocation.EAST}`]:
      GridLocation.WEST,
    [`${GridLocation.WEST},${GridLocation.EAST},${GridLocation.NORTH}`]:
      GridLocation.SOUTH,
    [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST},${GridLocation.NORTHWEST}`]:
      GridLocation.SOUTHEAST,
    [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST},${GridLocation.NORTHEAST}`]:
      GridLocation.SOUTHWEST,
    [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST},${GridLocation.SOUTHEAST}`]:
      GridLocation.NORTHWEST,
    [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST},${GridLocation.SOUTHWEST}`]:
      GridLocation.NORTHEAST,
    [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST},${GridLocation.SOUTHEAST}`]:
      GridLocation.NORTHWEST,
    [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST},${GridLocation.SOUTHWEST}`]:
      GridLocation.NORTHEAST,
    [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST},${GridLocation.NORTHWEST}`]:
      GridLocation.SOUTHEAST,
    [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST},${GridLocation.NORTHEAST}`]:
      GridLocation.SOUTHWEST,
  };

  private readonly LAMBDA_DASH_ZERO_TURNS_LOCATION_MAP: Record<
    string,
    GridLocation
  > = {
    [`${GridLocation.NORTH},${GridLocation.SOUTH},${GridLocation.WEST}`]:
      GridLocation.EAST,
    [`${GridLocation.EAST},${GridLocation.WEST},${GridLocation.SOUTH}`]:
      GridLocation.NORTH,
    [`${GridLocation.NORTH},${GridLocation.SOUTH},${GridLocation.EAST}`]:
      GridLocation.WEST,
    [`${GridLocation.WEST},${GridLocation.EAST},${GridLocation.SOUTH}`]:
      GridLocation.NORTH,
    [`${GridLocation.SOUTH},${GridLocation.NORTH},${GridLocation.WEST}`]:
      GridLocation.EAST,
    [`${GridLocation.EAST},${GridLocation.WEST},${GridLocation.NORTH}`]:
      GridLocation.SOUTH,
    [`${GridLocation.SOUTH},${GridLocation.NORTH},${GridLocation.EAST}`]:
      GridLocation.WEST,
    [`${GridLocation.WEST},${GridLocation.EAST},${GridLocation.NORTH}`]:
      GridLocation.SOUTH,
    [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST},${GridLocation.NORTHWEST}`]:
      GridLocation.SOUTHEAST,
    [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST},${GridLocation.NORTHEAST}`]:
      GridLocation.SOUTHWEST,
    [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST},${GridLocation.SOUTHEAST}`]:
      GridLocation.NORTHWEST,
    [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST},${GridLocation.SOUTHWEST}`]:
      GridLocation.NORTHEAST,
    [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST},${GridLocation.SOUTHEAST}`]:
      GridLocation.NORTHWEST,
    [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST},${GridLocation.SOUTHWEST}`]:
      GridLocation.NORTHEAST,
    [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST},${GridLocation.NORTHWEST}`]:
      GridLocation.SOUTHEAST,
    [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST},${GridLocation.NORTHEAST}`]:
      GridLocation.SOUTHWEST,
  };

  private readonly DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP: Record<
    string,
    GridLocation
  > = {
    [`${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.EAST,
    [`${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.SOUTH,
    [`${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.WEST,
    [`${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.NORTH,
    [`${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]:
      GridLocation.SOUTHEAST,
    [`${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]:
      GridLocation.NORTHEAST,
    [`${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]:
      GridLocation.NORTHWEST,
    [`${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]:
      GridLocation.SOUTHWEST,
  };

  private readonly NON_ZERO_TURNS_DASH_LOCATION_MAP: Record<
    string,
    Record<GridLocation, GridLocation>
  > = {
    clockwise: {
      [GridLocation.NORTH]: GridLocation.EAST,
      [GridLocation.EAST]: GridLocation.SOUTH,
      [GridLocation.SOUTH]: GridLocation.WEST,
      [GridLocation.WEST]: GridLocation.NORTH,
      [GridLocation.NORTHEAST]: GridLocation.SOUTHEAST,
      [GridLocation.SOUTHEAST]: GridLocation.SOUTHWEST,
      [GridLocation.SOUTHWEST]: GridLocation.NORTHWEST,
      [GridLocation.NORTHWEST]: GridLocation.NORTHEAST,
      [GridLocation.CENTER]: GridLocation.CENTER,
    },
    counter_clockwise: {
      [GridLocation.NORTH]: GridLocation.WEST,
      [GridLocation.EAST]: GridLocation.NORTH,
      [GridLocation.SOUTH]: GridLocation.EAST,
      [GridLocation.WEST]: GridLocation.SOUTH,
      [GridLocation.NORTHEAST]: GridLocation.NORTHWEST,
      [GridLocation.SOUTHEAST]: GridLocation.NORTHEAST,
      [GridLocation.SOUTHWEST]: GridLocation.SOUTHEAST,
      [GridLocation.NORTHWEST]: GridLocation.SOUTHWEST,
      [GridLocation.CENTER]: GridLocation.CENTER,
    },
  };

  private readonly DIAMOND_DASH_LOCATION_MAP: Record<string, GridLocation> = {
    [`${GridLocation.NORTH},${GridLocation.NORTHWEST}`]: GridLocation.EAST,
    [`${GridLocation.NORTH},${GridLocation.NORTHEAST}`]: GridLocation.WEST,
    [`${GridLocation.NORTH},${GridLocation.SOUTHEAST}`]: GridLocation.WEST,
    [`${GridLocation.NORTH},${GridLocation.SOUTHWEST}`]: GridLocation.EAST,
    [`${GridLocation.EAST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTH,
    [`${GridLocation.EAST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTH,
    [`${GridLocation.EAST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTH,
    [`${GridLocation.EAST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTH,
    [`${GridLocation.SOUTH},${GridLocation.NORTHWEST}`]: GridLocation.EAST,
    [`${GridLocation.SOUTH},${GridLocation.NORTHEAST}`]: GridLocation.WEST,
    [`${GridLocation.SOUTH},${GridLocation.SOUTHEAST}`]: GridLocation.WEST,
    [`${GridLocation.SOUTH},${GridLocation.SOUTHWEST}`]: GridLocation.EAST,
    [`${GridLocation.WEST},${GridLocation.NORTHWEST}`]: GridLocation.SOUTH,
    [`${GridLocation.WEST},${GridLocation.NORTHEAST}`]: GridLocation.SOUTH,
    [`${GridLocation.WEST},${GridLocation.SOUTHEAST}`]: GridLocation.NORTH,
    [`${GridLocation.WEST},${GridLocation.SOUTHWEST}`]: GridLocation.NORTH,
  };

  private readonly BOX_DASH_LOCATION_MAP: Record<string, GridLocation> = {
    [`${GridLocation.NORTHEAST},${GridLocation.NORTH}`]: GridLocation.SOUTHEAST,
    [`${GridLocation.NORTHEAST},${GridLocation.EAST}`]: GridLocation.NORTHWEST,
    [`${GridLocation.NORTHEAST},${GridLocation.SOUTH}`]: GridLocation.NORTHWEST,
    [`${GridLocation.NORTHEAST},${GridLocation.WEST}`]: GridLocation.SOUTHEAST,
    [`${GridLocation.SOUTHEAST},${GridLocation.NORTH}`]: GridLocation.SOUTHWEST,
    [`${GridLocation.SOUTHEAST},${GridLocation.EAST}`]: GridLocation.SOUTHWEST,
    [`${GridLocation.SOUTHEAST},${GridLocation.SOUTH}`]: GridLocation.NORTHEAST,
    [`${GridLocation.SOUTHEAST},${GridLocation.WEST}`]: GridLocation.NORTHEAST,
    [`${GridLocation.SOUTHWEST},${GridLocation.NORTH}`]: GridLocation.SOUTHEAST,
    [`${GridLocation.SOUTHWEST},${GridLocation.EAST}`]: GridLocation.NORTHWEST,
    [`${GridLocation.SOUTHWEST},${GridLocation.SOUTH}`]: GridLocation.NORTHWEST,
    [`${GridLocation.SOUTHWEST},${GridLocation.WEST}`]: GridLocation.SOUTHEAST,
    [`${GridLocation.NORTHWEST},${GridLocation.NORTH}`]: GridLocation.SOUTHWEST,
    [`${GridLocation.NORTHWEST},${GridLocation.EAST}`]: GridLocation.SOUTHWEST,
    [`${GridLocation.NORTHWEST},${GridLocation.SOUTH}`]: GridLocation.NORTHEAST,
    [`${GridLocation.NORTHWEST},${GridLocation.WEST}`]: GridLocation.NORTHEAST,
  };

  calculateDashLocationFromPictographData(
    pictographData: PictographData,
    isBlueArrow: boolean
  ): GridLocation {
    /**
     * High-level method to calculate dash location from pictograph data.
     *
     * This method automatically extracts all necessary parameters from the pictograph data
     * using pictograph analysis, then calls the detailed calculation method.
     */
    // Extract motion data for the specified arrow
    const motion = isBlueArrow
      ? pictographData.motions.blue
      : pictographData.motions.red;
    const otherMotion = isBlueArrow
      ? pictographData.motions.red
      : pictographData.motions.blue;

    if (motion?.motionType.toLowerCase() !== "dash") {
      // If not a dash motion, return start location as fallback
      return motion?.startLocation || GridLocation.NORTH;
    }

    // Use analysis service to extract all the parameters
    // For simplified implementation, using basic parameter extraction
    const letterInfo = this.getLetterInfo(pictographData);
    const gridInfo = this.getGridInfo(pictographData);

    // Call the detailed calculation method with all parameters
    return this.calculateDashLocation(
      motion,
      otherMotion,
      letterInfo.letterType,
      gridInfo.gridMode,
      gridInfo.shiftLocation,
      letterInfo.isPhiDash,
      letterInfo.isPsiDash,
      letterInfo.isLambda,
      letterInfo.isLambdaDash
    );
  }

  calculateDashLocation(
    motion: MotionData,
    otherMotion?: MotionData,
    letterType?: LetterType,
    gridMode?: GridMode,
    shiftLocation?: GridLocation,
    isPhiDash = false,
    isPsiDash = false,
    isLambda = false,
    isLambdaDash = false
  ): GridLocation {
    /**
     * Calculate dash arrow location using proven calculation algorithms.
     */

    // Φ_DASH and Ψ_DASH special handling
    if (isPhiDash || isPsiDash) {
      const location = this.getPhiDashPsiDashLocation(motion, otherMotion);
      console.groupEnd();
      return location;
    }

    // Λ (Lambda) zero turns special case
    if (isLambda && motion.turns === 0 && otherMotion) {
      const location = this.getLambdaZeroTurnsLocation(motion, otherMotion);
      console.groupEnd();
      return location;
    }

    // Λ_DASH (Lambda Dash) zero turns special case
    if (isLambdaDash && motion.turns === 0 && otherMotion) {
      const location = this.getLambdaDashZeroTurnsLocation(motion, otherMotion);
      console.groupEnd();
      return location;
    }

    // Zero turns - check for Type 3 or default
    if (motion.turns === 0) {
      const location = this.defaultZeroTurnsDashLocation(
        motion,
        letterType,
        gridMode,
        shiftLocation
      );
      console.groupEnd();
      return location;
    }

    // Non-zero turns
    const location = this.dashLocationNonZeroTurns(motion);
    console.groupEnd();
    return location;
  }

  private getLambdaDashZeroTurnsLocation(
    motion: MotionData,
    otherMotion: MotionData
  ): GridLocation {
    /**Handle Λ_DASH (Lambda Dash) zero turns special case.*/
    const key = `${motion.startLocation},${motion.endLocation},${otherMotion.endLocation}`;
    return (
      this.LAMBDA_DASH_ZERO_TURNS_LOCATION_MAP[key] || motion.startLocation
    );
  }

  private getPhiDashPsiDashLocation(
    motion: MotionData,
    otherMotion?: MotionData
  ): GridLocation {
    /**Handle Φ_DASH and Ψ_DASH location calculation.*/
    if (!otherMotion) {
      // Fallback to default logic if missing data
      return this.defaultZeroTurnsDashLocation(motion);
    }

    // Both motions have zero turns
    if (motion.turns === 0 && otherMotion.turns === 0) {
      const key = `${motion.color},${motion.startLocation},${motion.endLocation}`;
      return this.PHI_DASH_PSI_DASH_LOCATION_MAP[key] || motion.startLocation;
    }

    // Current motion has zero turns, other doesn't
    if (motion.turns === 0) {
      const oppositeLocation = this.dashLocationNonZeroTurns(otherMotion);
      return this.getOppositeLocation(oppositeLocation);
    }

    // Current motion has non-zero turns
    return this.dashLocationNonZeroTurns(motion);
  }

  private getLambdaZeroTurnsLocation(
    motion: MotionData,
    otherMotion: MotionData
  ): GridLocation {
    /**Handle Λ (Lambda) zero turns special case.*/
    const key = `${motion.startLocation},${motion.endLocation},${otherMotion.endLocation}`;
    return this.LAMBDA_ZERO_TURNS_LOCATION_MAP[key] || motion.startLocation;
  }

  private defaultZeroTurnsDashLocation(
    motion: MotionData,
    letterType?: LetterType,
    gridMode?: GridMode,
    shiftLocation?: GridLocation
  ): GridLocation {
    /**Calculate default zero turns dash location.*/

    // Type 3 scenario detection and handling
    if (letterType === LetterType.TYPE3 && gridMode && shiftLocation) {
      return this.calculateDashLocationBasedOnShift(
        motion,
        gridMode,
        shiftLocation
      );
    }

    // Default zero turns mapping
    const key = `${motion.startLocation},${motion.endLocation}`;
    return (
      this.DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP[key] || motion.startLocation
    );
  }

  private dashLocationNonZeroTurns(motion: MotionData): GridLocation {
    /**Calculate dash location for non-zero turns.*/
    const rotationDirection = (motion.rotationDirection ?? "").toLowerCase();
    if (
      rotationDirection === "" ||
      rotationDirection === "norotation" ||
      rotationDirection === "none" ||
      rotationDirection === "no_rotation" ||
      rotationDirection === "no_rot"
    ) {
      // A dash with no spin direction (common for zero-turn dashes that
      // still reach this branch) has no "clockwise vs counter-clockwise"
      // answer — the arrow just stays at its starting grid point.
      return motion.startLocation;
    }

    // Normalize rotation direction to map keys
    // RotationDirection enum uses "cw" and "ccw", but map uses full names
    let normalizedDirection: string;
    if (rotationDirection === "cw" || rotationDirection === "clockwise") {
      normalizedDirection = "clockwise";
    } else if (
      rotationDirection === "ccw" ||
      rotationDirection === "counter_clockwise" ||
      rotationDirection === "counterclockwise"
    ) {
      normalizedDirection = "counter_clockwise";
    } else {
      // If we don't recognize it, default to clockwise
      console.warn(
        `Unrecognized rotation direction: ${rotationDirection}, defaulting to clockwise`
      );
      normalizedDirection = "clockwise";
    }

    const directionMap =
      this.NON_ZERO_TURNS_DASH_LOCATION_MAP[normalizedDirection];
    return directionMap?.[motion.startLocation] || motion.startLocation;
  }

  private calculateDashLocationBasedOnShift(
    motion: MotionData,
    gridMode: GridMode,
    shiftLocation: GridLocation
  ): GridLocation {
    /**Calculate Type 3 dash location based on shift arrow location.*/
    const startLocation = motion.startLocation;

    if (gridMode === GridMode.DIAMOND) {
      const key = `${startLocation},${shiftLocation}`;
      return this.DIAMOND_DASH_LOCATION_MAP[key] || startLocation;
    } else if (gridMode === GridMode.BOX) {
      const key = `${startLocation},${shiftLocation}`;
      return this.BOX_DASH_LOCATION_MAP[key] || startLocation;
    }

    // Fallback to default if grid mode not recognized
    return this.defaultZeroTurnsDashLocation(motion);
  }

  private getOppositeLocation(location: GridLocation): GridLocation {
    /**Get opposite location using proven location mapping.*/
    const oppositeMap: Record<GridLocation, GridLocation> = {
      [GridLocation.NORTH]: GridLocation.SOUTH,
      [GridLocation.SOUTH]: GridLocation.NORTH,
      [GridLocation.EAST]: GridLocation.WEST,
      [GridLocation.WEST]: GridLocation.EAST,
      [GridLocation.NORTHEAST]: GridLocation.SOUTHWEST,
      [GridLocation.SOUTHWEST]: GridLocation.NORTHEAST,
      [GridLocation.SOUTHEAST]: GridLocation.NORTHWEST,
      [GridLocation.NORTHWEST]: GridLocation.SOUTHEAST,
      [GridLocation.CENTER]: GridLocation.CENTER,
    };
    return oppositeMap[location] || location;
  }

  // Simplified helper methods for extracting information from pictograph data
  private getLetterInfo(pictographData: PictographData): {
    letterType: LetterType;
    isPhiDash: boolean;
    isPsiDash: boolean;
    isLambda: boolean;
    isLambdaDash: boolean;
  } {
    const letter = pictographData.letter;

    // Use the reliable shared getLetterType function instead of regex
    let letterType: LetterType = LetterType.TYPE1; // Default fallback

    if (letter) {
      try {
        // Convert string to Letter enum and get type
        const letterEnum = letter as Letter;
        letterType = getLetterType(letterEnum);
      } catch (error) {
        console.warn(
          `Failed to determine letter type for "${letter}", defaulting to TYPE1:`,
          error
        );
        letterType = LetterType.TYPE1;
      }
    }

    return {
      letterType,
      isPhiDash: letter === Letter.PHI_DASH,
      isPsiDash: letter === Letter.PSI_DASH,
      isLambda: letter === Letter.LAMBDA,
      isLambdaDash: letter === Letter.LAMBDA_DASH,
    };
  }

  private getGridInfo(pictographData: PictographData): {
    gridMode: GridMode;
    shiftLocation?: GridLocation;
  } {
    // Use gridMode directly from motion data (now stored in each motion)
    const gridMode =
      pictographData.motions.blue?.gridMode ||
      pictographData.motions.red?.gridMode ||
      GridMode.DIAMOND;

    const result: { gridMode: GridMode; shiftLocation?: GridLocation } = {
      gridMode,
    };

    // For Type 3 pictographs, detect shift location using the shift arrow
    const blue = pictographData.motions.blue;
    const red = pictographData.motions.red;

    if (blue && red) {
      // Determine which motion is the shift motion (non-dash)
      const blueIsShift = ["pro", "anti", "float"].includes(
        blue.motionType.toLowerCase() || ""
      );
      const redIsShift = ["pro", "anti", "float"].includes(
        red.motionType.toLowerCase() || ""
      );

      let shiftMotion: MotionData | undefined;
      if (blueIsShift && !redIsShift) {
        shiftMotion = blue;
      } else if (redIsShift && !blueIsShift) {
        shiftMotion = red;
      }

      // Calculate shift location if we found a shift motion
      if (shiftMotion) {
        const shiftCalculator = new ShiftLocationCalculator();
        result.shiftLocation = shiftCalculator.calculateLocation(shiftMotion);
      }
    }

    return result;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of dashLocationCalculator to avoid DI container rebuilds.
// ============================================================================

export const dashLocationCalculator = new DashLocationCalculator();
