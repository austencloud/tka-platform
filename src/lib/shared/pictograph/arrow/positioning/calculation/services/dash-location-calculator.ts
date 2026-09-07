/**
 * Dash Location Calculator
 *
 * Comprehensive dash location calculation logic with all special cases.
 * Direct TypeScript port of the Python DashLocationCalculator.
 */

import {
  GridLocation,
  GridMode,
} from "../../../../grid/domain/enums/grid-enums";
import {
  getLetterType,
  Letter,
} from "../../../../../foundation/domain/models/letter";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import { calculateShiftLocation } from "./shift-location-calculator";
import { LetterType } from "../../../../../foundation/domain/models/letter-type";

export interface IDashLocationCalculator {
  calculateDashLocationFromPictographData(
    pictographData: PictographData,
    isLeftArrow: boolean
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

const PHI_DASH_PSI_DASH_LOCATION_MAP: Record<string, GridLocation> = {
  [`right,${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.EAST,
  [`right,${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.NORTH,
  [`right,${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.EAST,
  [`right,${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.NORTH,
  [`left,${GridLocation.NORTH},${GridLocation.SOUTH}`]: GridLocation.WEST,
  [`left,${GridLocation.EAST},${GridLocation.WEST}`]: GridLocation.SOUTH,
  [`left,${GridLocation.SOUTH},${GridLocation.NORTH}`]: GridLocation.WEST,
  [`left,${GridLocation.WEST},${GridLocation.EAST}`]: GridLocation.SOUTH,
  [`right,${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]:
    GridLocation.NORTHEAST,
  [`right,${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]:
    GridLocation.SOUTHEAST,
  [`right,${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]:
    GridLocation.SOUTHEAST,
  [`right,${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]:
    GridLocation.NORTHEAST,
  [`left,${GridLocation.NORTHWEST},${GridLocation.SOUTHEAST}`]:
    GridLocation.SOUTHWEST,
  [`left,${GridLocation.NORTHEAST},${GridLocation.SOUTHWEST}`]:
    GridLocation.NORTHWEST,
  [`left,${GridLocation.SOUTHWEST},${GridLocation.NORTHEAST}`]:
    GridLocation.NORTHWEST,
  [`left,${GridLocation.SOUTHEAST},${GridLocation.NORTHWEST}`]:
    GridLocation.SOUTHWEST,
};

const LAMBDA_ZERO_TURNS_LOCATION_MAP: Record<string, GridLocation> = {
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

const LAMBDA_DASH_ZERO_TURNS_LOCATION_MAP: Record<string, GridLocation> = {
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

const DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP: Record<string, GridLocation> = {
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

const NON_ZERO_TURNS_DASH_LOCATION_MAP: Record<
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

const DIAMOND_DASH_LOCATION_MAP: Record<string, GridLocation> = {
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

const BOX_DASH_LOCATION_MAP: Record<string, GridLocation> = {
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

function getOppositeLocation(location: GridLocation): GridLocation {
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

function dashLocationNonZeroTurns(motion: MotionData): GridLocation {
  const rotationDirection = (motion.rotationDirection ?? "").toLowerCase();
  if (
    rotationDirection === "" ||
    rotationDirection === "norotation" ||
    rotationDirection === "none" ||
    rotationDirection === "no_rotation" ||
    rotationDirection === "no_rot"
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

  const directionMap = NON_ZERO_TURNS_DASH_LOCATION_MAP[normalizedDirection];
  return directionMap?.[motion.startLocation] || motion.startLocation;
}

function calculateDashLocationBasedOnShift(
  motion: MotionData,
  gridMode: GridMode,
  shiftLocation: GridLocation
): GridLocation {
  const startLocation = motion.startLocation;

  if (gridMode === GridMode.DIAMOND) {
    const key = `${startLocation},${shiftLocation}`;
    return DIAMOND_DASH_LOCATION_MAP[key] || startLocation;
  } else if (gridMode === GridMode.BOX) {
    const key = `${startLocation},${shiftLocation}`;
    return BOX_DASH_LOCATION_MAP[key] || startLocation;
  }

  return defaultZeroTurnsDashLocation(motion);
}

function defaultZeroTurnsDashLocation(
  motion: MotionData,
  letterType?: LetterType,
  gridMode?: GridMode,
  shiftLocation?: GridLocation
): GridLocation {
  if (letterType === LetterType.TYPE3 && gridMode && shiftLocation) {
    return calculateDashLocationBasedOnShift(motion, gridMode, shiftLocation);
  }

  const key = `${motion.startLocation},${motion.endLocation}`;
  return DEFAULT_ZERO_TURNS_DASH_LOCATION_MAP[key] || motion.startLocation;
}

function getLambdaDashZeroTurnsLocation(
  motion: MotionData,
  otherMotion: MotionData
): GridLocation {
  const key = `${motion.startLocation},${motion.endLocation},${otherMotion.endLocation}`;
  return LAMBDA_DASH_ZERO_TURNS_LOCATION_MAP[key] || motion.startLocation;
}

function getPhiDashPsiDashLocation(
  motion: MotionData,
  otherMotion?: MotionData
): GridLocation {
  if (!otherMotion) {
    return defaultZeroTurnsDashLocation(motion);
  }

  if (motion.turns === 0 && otherMotion.turns === 0) {
    const key = `${motion.hand},${motion.startLocation},${motion.endLocation}`;
    return PHI_DASH_PSI_DASH_LOCATION_MAP[key] || motion.startLocation;
  }

  if (motion.turns === 0) {
    const oppositeLocation = dashLocationNonZeroTurns(otherMotion);
    return getOppositeLocation(oppositeLocation);
  }

  return dashLocationNonZeroTurns(motion);
}

function getLambdaZeroTurnsLocation(
  motion: MotionData,
  otherMotion: MotionData
): GridLocation {
  const key = `${motion.startLocation},${motion.endLocation},${otherMotion.endLocation}`;
  return LAMBDA_ZERO_TURNS_LOCATION_MAP[key] || motion.startLocation;
}

function getLetterInfo(pictographData: PictographData): {
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

function getGridInfo(pictographData: PictographData): {
  gridMode: GridMode;
  shiftLocation?: GridLocation;
} {
  const gridMode =
    pictographData.motions.left?.gridMode ||
    pictographData.motions.right?.gridMode ||
    GridMode.DIAMOND;

  const result: { gridMode: GridMode; shiftLocation?: GridLocation } = {
    gridMode,
  };

  const left = pictographData.motions.left;
  const right = pictographData.motions.right;

  if (left && right) {
    const leftIsShift = ["pro", "anti", "float"].includes(
      left.motionType.toLowerCase() || ""
    );
    const rightIsShift = ["pro", "anti", "float"].includes(
      right.motionType.toLowerCase() || ""
    );

    let shiftMotion: MotionData | undefined;
    if (leftIsShift && !rightIsShift) {
      shiftMotion = left;
    } else if (rightIsShift && !leftIsShift) {
      shiftMotion = right;
    }

    if (shiftMotion) {
      result.shiftLocation = calculateShiftLocation(shiftMotion);
    }
  }

  return result;
}

export function calculateDashLocationFromPictographData(
  pictographData: PictographData,
  isLeftArrow: boolean
): GridLocation {
  const motion = isLeftArrow
    ? pictographData.motions.left
    : pictographData.motions.right;
  const otherMotion = isLeftArrow
    ? pictographData.motions.right
    : pictographData.motions.left;

  if (motion?.motionType.toLowerCase() !== "dash") {
    return motion?.startLocation || GridLocation.NORTH;
  }

  const letterInfo = getLetterInfo(pictographData);
  const gridInfo = getGridInfo(pictographData);

  return calculateDashLocation(
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

export function calculateDashLocation(
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
    return getPhiDashPsiDashLocation(motion, otherMotion);
  }

  if (isLambda && motion.turns === 0 && otherMotion) {
    return getLambdaZeroTurnsLocation(motion, otherMotion);
  }

  if (isLambdaDash && motion.turns === 0 && otherMotion) {
    return getLambdaDashZeroTurnsLocation(motion, otherMotion);
  }

  if (motion.turns === 0) {
    return defaultZeroTurnsDashLocation(
      motion,
      letterType,
      gridMode,
      shiftLocation
    );
  }

  return dashLocationNonZeroTurns(motion);
}
