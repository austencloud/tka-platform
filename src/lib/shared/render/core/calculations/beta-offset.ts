import type { GridLocation, GridMode, VectorDirection } from "../types.js";
import { HandSide } from "@tka/tka-types";
import { isCardinal } from "../types.js";
import {
  DIAMOND_RADIAL_MAP,
  DIAMOND_NON_RADIAL_MAP,
  BOX_RADIAL_MAP,
  BOX_NON_RADIAL_MAP,
  SHIFT_RADIAL_MAP,
  SHIFT_NON_RADIAL_MAP,
  LETTER_I_RADIAL_MAP,
  LETTER_I_NON_RADIAL_MAP,
  OPPOSITE_DIRECTIONS,
} from "../constants/direction-maps.js";
import {
  getBetaOffsetSize,
  isUnilateralProp,
  isBuugengFamilyProp,
} from "../constants/prop-classification.js";

export interface BetaMotionInput {
  startLocation: string;
  endLocation: string;
  endOrientation?: string;
  motionType: string;
  hand: HandSide;
  propType?: string;
}

export interface BetaOffsetInput {
  leftMotion: BetaMotionInput;
  rightMotion: BetaMotionInput;
  letter: string;
  gridMode: GridMode;
  leftPropType?: string;
  rightPropType?: string;
  leftBuugengFlipped?: boolean;
  rightBuugengFlipped?: boolean;
}

const RADIAL_ORIENTATIONS = ["in", "out"];
const NON_RADIAL_ORIENTATIONS = ["clock", "counter"];

function isRadialOrientation(ori: string | undefined): boolean {
  if (!ori) return false;
  return RADIAL_ORIENTATIONS.includes(ori.toLowerCase());
}

function isNonRadialOrientation(ori: string | undefined): boolean {
  if (!ori) return false;
  return NON_RADIAL_ORIENTATIONS.includes(ori.toLowerCase());
}

function isRadialForMapSelection(
  leftEndOri: string | undefined,
  rightEndOri: string | undefined
): boolean {
  const rightNorm = rightEndOri?.toLowerCase();
  const leftNorm = leftEndOri?.toLowerCase();

  const rightIsInOrOut = rightNorm === "in" || rightNorm === "out";
  const leftIsIn = leftNorm === "in";
  const leftIsOut = leftNorm === "out";

  return (rightIsInOrOut && leftIsIn) || leftIsOut;
}

function isShiftMotion(motionType: string): boolean {
  const type = motionType.toLowerCase();
  return type === "pro" || type === "anti" || type === "float";
}

function directionToOffset(
  direction: VectorDirection,
  distance: number
): { x: number; y: number } {
  switch (direction) {
    case "up":
      return { x: 0, y: -distance };
    case "down":
      return { x: 0, y: distance };
    case "left":
      return { x: -distance, y: 0 };
    case "right":
      return { x: distance, y: 0 };
    case "upright":
      return { x: distance, y: -distance };
    case "downright":
      return { x: distance, y: distance };
    case "upleft":
      return { x: -distance, y: -distance };
    case "downleft":
      return { x: -distance, y: distance };
    default:
      return { x: 0, y: 0 };
  }
}

function getOppositeDirection(direction: VectorDirection): VectorDirection {
  return OPPOSITE_DIRECTIONS[direction];
}

function getStaticDashDirection(
  endLocation: string,
  hand: HandSide,
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase() as GridLocation;
  const isDiamond = isCardinal(loc);

  let map: Record<GridLocation, Record<HandSide, VectorDirection>>;
  if (isDiamond) {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  } else {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  }

  const locationMap = map[loc];
  if (!locationMap) return null;
  return locationMap[hand] ?? null;
}

function getShiftDirection(
  startLocation: string,
  endLocation: string,
  hand: HandSide,
  isRadial: boolean
): VectorDirection | null {
  const startLoc = startLocation.toLowerCase() as GridLocation;
  const endLoc = endLocation.toLowerCase() as GridLocation;

  const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;
  const startMap = map[startLoc];
  if (!startMap) {
    return getStaticDashDirection(endLoc, hand, isRadial);
  }

  const direction = startMap[endLoc];
  if (!direction) {
    return getStaticDashDirection(endLoc, hand, isRadial);
  }

  return direction;
}

function getLetterIDirection(
  endLocation: string,
  hand: HandSide,
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase() as GridLocation;
  const map = isRadial ? LETTER_I_RADIAL_MAP : LETTER_I_NON_RADIAL_MAP;
  const locationMap = map[loc];
  if (!locationMap) return null;
  return locationMap[hand] ?? null;
}

function getLetterGHDirection(
  endLocation: string,
  hand: HandSide,
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase();

  const isBox = !isCardinal(loc);

  let map: Record<GridLocation, Record<HandSide, VectorDirection>>;
  if (isBox) {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  } else {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  }

  const locationMap = map[loc as GridLocation];
  if (!locationMap) return null;

  const baseDirection = locationMap[HandSide.RIGHT];
  if (!baseDirection) return null;

  return hand === HandSide.RIGHT
    ? baseDirection
    : getOppositeDirection(baseDirection);
}

function getLetterYZDirection(
  leftMotion: BetaMotionInput,
  rightMotion: BetaMotionInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean
): VectorDirection | null {
  const rightIsShift = isShiftMotion(rightMotion.motionType);
  const leftIsShift = isShiftMotion(leftMotion.motionType);

  const shiftMotion = rightIsShift ? rightMotion : leftIsShift ? leftMotion : null;
  if (!shiftMotion) return null;

  const findNonShift = (): BetaMotionInput | null => {
    const rightType = rightMotion.motionType.toLowerCase();
    const leftType = leftMotion.motionType.toLowerCase();
    if (rightType === "static") return rightMotion;
    if (leftType === "static") return leftMotion;
    if (rightType === "dash") return rightMotion;
    if (leftType === "dash") return leftMotion;
    return null;
  };

  const nonShiftMotion = findNonShift();
  if (!nonShiftMotion) return null;

  const shiftDirection = getShiftDirection(
    shiftMotion.startLocation,
    shiftMotion.endLocation,
    shiftMotion.hand,
    isRadial
  );
  if (!shiftDirection) return null;

  const isTargetShift = targetMotion.hand === shiftMotion.hand;
  return isTargetShift ? shiftDirection : getOppositeDirection(shiftDirection);
}

function calculateDirection(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean
): VectorDirection | null {
  const { leftMotion, rightMotion, letter } = input;

  if (letter === "Y" || letter === "Z" || letter === "Y-" || letter === "Z-") {
    return getLetterYZDirection(leftMotion, rightMotion, targetMotion, isRadial);
  }

  if (isShiftMotion(targetMotion.motionType)) {
    if (letter === "G" || letter === "H") {
      return getLetterGHDirection(targetMotion.endLocation, targetMotion.hand, isRadial);
    }
    if (letter === "I") {
      return getLetterIDirection(targetMotion.endLocation, targetMotion.hand, isRadial);
    }
    const otherMotion =
      targetMotion.hand === HandSide.LEFT ? rightMotion : leftMotion;
    if (isShiftMotion(otherMotion.motionType)) {
      const leftDirection = getShiftDirection(
        leftMotion.startLocation,
        leftMotion.endLocation,
        HandSide.LEFT,
        isRadial
      );
      if (!leftDirection) return null;
      return targetMotion.hand === HandSide.LEFT
        ? leftDirection
        : getOppositeDirection(leftDirection);
    }
    return getShiftDirection(
      targetMotion.startLocation,
      targetMotion.endLocation,
      targetMotion.hand,
      isRadial
    );
  }

  return getStaticDashDirection(targetMotion.endLocation, targetMotion.hand, isRadial);
}

export function calculateBetaOffset(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput
): { x: number; y: number } {
  const { leftMotion, rightMotion, gridMode } = input;

  const leftEndLoc = leftMotion.endLocation.toLowerCase();
  const rightEndLoc = rightMotion.endLocation.toLowerCase();

  if (leftEndLoc !== rightEndLoc) {
    return { x: 0, y: 0 };
  }

  const leftIsHand = leftMotion.propType === "hand";
  const rightIsHand = rightMotion.propType === "hand";
  const actualLeftPropType = leftIsHand
    ? "hand"
    : (input.leftPropType ?? leftMotion.propType ?? "staff");
  const actualRightPropType = rightIsHand
    ? "hand"
    : (input.rightPropType ?? rightMotion.propType ?? "staff");

  const bothAreHands = actualLeftPropType === "hand" && actualRightPropType === "hand";

  if (bothAreHands) {
    const distance = getBetaOffsetSize("hand", gridMode);

    const eastPositions = ["e", "ne", "se"];
    const westPositions = ["w", "nw", "sw"];

    const leftStartLoc = leftMotion.startLocation.toLowerCase();
    const rightStartLoc = rightMotion.startLocation.toLowerCase();

    const leftFromEast = eastPositions.includes(leftStartLoc);
    const leftFromWest = westPositions.includes(leftStartLoc);
    const rightFromEast = eastPositions.includes(rightStartLoc);
    const rightFromWest = westPositions.includes(rightStartLoc);

    if (leftFromEast && rightFromWest) {
      return targetMotion.hand === HandSide.LEFT
        ? { x: distance, y: 0 }
        : { x: -distance, y: 0 };
    } else if (leftFromWest && rightFromEast) {
      return targetMotion.hand === HandSide.LEFT
        ? { x: -distance, y: 0 }
        : { x: distance, y: 0 };
    } else {
      return targetMotion.hand === HandSide.LEFT
        ? { x: -distance, y: 0 }
        : { x: distance, y: 0 };
    }
  }

  const leftEndOri = leftMotion.endOrientation;
  const rightEndOri = rightMotion.endOrientation;

  const leftIsRadial = isRadialOrientation(leftEndOri);
  const rightIsRadial = isRadialOrientation(rightEndOri);
  const leftIsNonRadial = isNonRadialOrientation(leftEndOri);
  const rightIsNonRadial = isNonRadialOrientation(rightEndOri);

  const hybridOrientation =
    (rightIsRadial && leftIsNonRadial) || (rightIsNonRadial && leftIsRadial);

  if (hybridOrientation) {
    return { x: 0, y: 0 };
  }

  const bothRadial = rightIsRadial && leftIsRadial;
  const bothNonRadial = rightIsNonRadial && leftIsNonRadial;
  const sameTypeButDifferentOrientation =
    (bothRadial && rightEndOri?.toLowerCase() !== leftEndOri?.toLowerCase()) ||
    (bothNonRadial && rightEndOri?.toLowerCase() !== leftEndOri?.toLowerCase());

  const bothAreBuugengFamily =
    isBuugengFamilyProp(actualLeftPropType) &&
    isBuugengFamilyProp(actualRightPropType);

  if (bothAreBuugengFamily) {
    const leftChirality = input.leftBuugengFlipped ?? false;
    const rightChirality = input.rightBuugengFlipped ?? false;
    const oppositeChirality = leftChirality !== rightChirality; 

    if (oppositeChirality) {
      return { x: 0, y: 0 };
    }
  }

  const actualPropType =
    targetMotion.hand === HandSide.LEFT
      ? actualLeftPropType
      : actualRightPropType;

  if (sameTypeButDifferentOrientation && isUnilateralProp(actualPropType)) {
    return { x: 0, y: 0 };
  }

  if (sameTypeButDifferentOrientation && actualPropType === "trigeng") {
    return { x: 0, y: 0 };
  }

  const isRadial = isRadialForMapSelection(leftEndOri, rightEndOri);
  const direction = calculateDirection(input, targetMotion, isRadial);

  if (!direction) {
    return { x: 0, y: 0 };
  }

  const distance = getBetaOffsetSize(actualPropType, gridMode);
  return directionToOffset(direction, distance);
}
