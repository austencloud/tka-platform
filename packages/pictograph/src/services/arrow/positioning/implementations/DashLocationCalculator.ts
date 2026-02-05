import {
  GridLocation,
  GridMode,
  LetterType,
  getLetterType,
  Letter,
} from "@tka/types";
import type { MotionData, PictographData } from "@tka/types";
import type { IDashLocationCalculator } from "../contracts/IDashLocationCalculator";
import { ShiftLocationCalculator } from "./ShiftLocationCalculator";

/**
 * Dash Location Calculator Service
 *
 * Comprehensive dash location calculation logic with all special cases.
 * Handles Phi_DASH, Psi_DASH, Lambda zero turns, Type 3 scenarios,
 * and grid mode specific calculations (Diamond/Box).
 */
export class DashLocationCalculator implements IDashLocationCalculator {
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
    const motion = isBlueArrow
      ? pictographData.motions.blue
      : pictographData.motions.red;
    const otherMotion = isBlueArrow
      ? pictographData.motions.red
      : pictographData.motions.blue;

    if (motion?.motionType.toLowerCase() !== "dash") {
      return motion?.startLocation || GridLocation.NORTH;
    }

    const letterInfo = this.getLetterInfo(pictographData);
    const gridInfo = this.getGridInfo(pictographData);

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
    if (isPhiDash || isPsiDash) {
      return this.getPhiDashPsiDashLocation(motion, otherMotion);
    }

    if (isLambda && motion.turns === 0 && otherMotion) {
      return this.getLambdaZeroTurnsLocation(motion, otherMotion);
    }

    if (isLambdaDash && motion.turns === 0 && otherMotion) {
      return this.getLambdaDashZeroTurnsLocation(motion, otherMotion);
    }

    if (motion.turns === 0) {
      return this.defaultZeroTurnsDashLocation(
        motion,
        letterType,
        gridMode,
        shiftLocation
      );
    }

    return this.dashLocationNonZeroTurns(motion);
  }

  private getLambdaDashZeroTurnsLocation(
    motion: MotionData,
    otherMotion: MotionData
  ): GridLocation {
    const key = `${motion.startLocation},${motion.endLocation},${otherMotion.endLocation}`;
    return (
      this.LAMBDA_DASH_ZERO_TURNS_LOCATION_MAP[key] || motion.startLocation
    );
  }

  private getPhiDashPsiDashLocation(
    motion: MotionData,
    otherMotion?: MotionData
  ): GridLocation {
    if (!otherMotion) {
      return this.defaultZeroTurnsDashLocation(motion);
    }

    if (motion.turns === 0 && otherMotion.turns === 0) {
      const key = `${motion.color},${motion.startLocation},${motion.endLocation}`;
      return this.PHI_DASH_PSI_DASH_LOCATION_MAP[key] || motion.startLocation;
    }

    if (motion.turns === 0) {
      const oppositeLocation = this.dashLocationNonZeroTurns(otherMotion);
      return this.getOppositeLocation(oppositeLocation);
    }

    return this.dashLocationNonZeroTurns(motion);
  }

  private getLambdaZeroTurnsLocation(
    motion: MotionData,
    otherMotion: MotionData
  ): GridLocation {
    const key = `${motion.startLocation},${motion.endLocation},${otherMotion.endLocation}`;
    return this.LAMBDA_ZERO_TURNS_LOCATION_MAP[key] || motion.startLocation;
  }

  private defaultZeroTurnsDashLocation(
    motion: MotionData,
    letterType?: LetterType,
    gridMode?: GridMode,
    shiftLocation?: GridLocation
  ): GridLocation {
    if (letterType === LetterType.TYPE3 && gridMode && shiftLocation) {
      return this.calculateDashLocationBasedOnShift(
        motion,
        gridMode,
        shiftLocation
      );
    }

    const key = `${motion.startLocation},${motion.endLocation}`;
    return (
      this.DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP[key] || motion.startLocation
    );
  }

  private dashLocationNonZeroTurns(motion: MotionData): GridLocation {
    const rotationDirection = motion.rotationDirection.toLowerCase();
    if (
      rotationDirection === "norotation" ||
      rotationDirection === "none" ||
      rotationDirection === "no_rotation"
    ) {
      return motion.startLocation;
    }

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
    const startLocation = motion.startLocation;

    if (gridMode === GridMode.DIAMOND) {
      const key = `${startLocation},${shiftLocation}`;
      return this.DIAMOND_DASH_LOCATION_MAP[key] || startLocation;
    } else if (gridMode === GridMode.BOX) {
      const key = `${startLocation},${shiftLocation}`;
      return this.BOX_DASH_LOCATION_MAP[key] || startLocation;
    }

    return this.defaultZeroTurnsDashLocation(motion);
  }

  private getOppositeLocation(location: GridLocation): GridLocation {
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

  private getLetterInfo(pictographData: PictographData): {
    letterType: LetterType;
    isPhiDash: boolean;
    isPsiDash: boolean;
    isLambda: boolean;
    isLambdaDash: boolean;
  } {
    const letter = pictographData.letter;
    let letterType: LetterType = LetterType.TYPE1;

    if (letter) {
      try {
        const letterEnum = letter as Letter;
        letterType = getLetterType(letterEnum);
      } catch {
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
    const gridMode =
      pictographData.motions.blue?.gridMode ||
      pictographData.motions.red?.gridMode ||
      GridMode.DIAMOND;

    const result: { gridMode: GridMode; shiftLocation?: GridLocation } = {
      gridMode,
    };

    const blue = pictographData.motions.blue;
    const red = pictographData.motions.red;

    if (blue && red) {
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

      if (shiftMotion) {
        const shiftCalculator = new ShiftLocationCalculator();
        result.shiftLocation = shiftCalculator.calculateLocation(shiftMotion);
      }
    }

    return result;
  }
}
