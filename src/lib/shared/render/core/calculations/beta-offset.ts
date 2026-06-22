import type { GridLocation, GridMode, VectorDirection } from "../types.js";
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
  color: "blue" | "red";
  propType?: string;
}

export interface BetaOffsetInput {
  blueMotion: BetaMotionInput;
  redMotion: BetaMotionInput;
  letter: string;
  gridMode: GridMode;
  bluePropType?: string;
  redPropType?: string;
  blueBuugengFlipped?: boolean;
  redBuugengFlipped?: boolean;
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
  blueEndOri: string | undefined,
  redEndOri: string | undefined
): boolean {
  const redNorm = redEndOri?.toLowerCase();
  const blueNorm = blueEndOri?.toLowerCase();

  const redIsInOrOut = redNorm === "in" || redNorm === "out";
  const blueIsIn = blueNorm === "in";
  const blueIsOut = blueNorm === "out";

  return (redIsInOrOut && blueIsIn) || blueIsOut;
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
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase() as GridLocation;
  const isDiamond = isCardinal(loc);

  let map: Record<GridLocation, Record<"blue" | "red", VectorDirection>>;
  if (isDiamond) {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  } else {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  }

  const locationMap = map[loc];
  if (!locationMap) return null;
  return locationMap[color] ?? null;
}

function getShiftDirection(
  startLocation: string,
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const startLoc = startLocation.toLowerCase() as GridLocation;
  const endLoc = endLocation.toLowerCase() as GridLocation;

  const map = isRadial ? SHIFT_RADIAL_MAP : SHIFT_NON_RADIAL_MAP;
  const startMap = map[startLoc];
  if (!startMap) {
    return getStaticDashDirection(endLoc, color, isRadial);
  }

  const direction = startMap[endLoc];
  if (!direction) {
    return getStaticDashDirection(endLoc, color, isRadial);
  }

  return direction;
}

function getLetterIDirection(
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase() as GridLocation;
  const map = isRadial ? LETTER_I_RADIAL_MAP : LETTER_I_NON_RADIAL_MAP;
  const locationMap = map[loc];
  if (!locationMap) return null;
  return locationMap[color] ?? null;
}

function getLetterGHDirection(
  endLocation: string,
  color: "blue" | "red",
  isRadial: boolean
): VectorDirection | null {
  const loc = endLocation.toLowerCase();

  const isBox = !isCardinal(loc);

  let map: Record<GridLocation, Record<"blue" | "red", VectorDirection>>;
  if (isBox) {
    map = isRadial ? BOX_RADIAL_MAP : BOX_NON_RADIAL_MAP;
  } else {
    map = isRadial ? DIAMOND_RADIAL_MAP : DIAMOND_NON_RADIAL_MAP;
  }

  const locationMap = map[loc as GridLocation];
  if (!locationMap) return null;

  const baseDirection = locationMap["red"];
  if (!baseDirection) return null;

  return color === "red" ? baseDirection : getOppositeDirection(baseDirection);
}

function getLetterYZDirection(
  blueMotion: BetaMotionInput,
  redMotion: BetaMotionInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean
): VectorDirection | null {
  const redIsShift = isShiftMotion(redMotion.motionType);
  const blueIsShift = isShiftMotion(blueMotion.motionType);

  const shiftMotion = redIsShift ? redMotion : blueIsShift ? blueMotion : null;
  if (!shiftMotion) return null;

  const findNonShift = (): BetaMotionInput | null => {
    const redType = redMotion.motionType.toLowerCase();
    const blueType = blueMotion.motionType.toLowerCase();
    if (redType === "static") return redMotion;
    if (blueType === "static") return blueMotion;
    if (redType === "dash") return redMotion;
    if (blueType === "dash") return blueMotion;
    return null;
  };

  const nonShiftMotion = findNonShift();
  if (!nonShiftMotion) return null;

  const shiftDirection = getShiftDirection(
    shiftMotion.startLocation,
    shiftMotion.endLocation,
    shiftMotion.color,
    isRadial
  );
  if (!shiftDirection) return null;

  const isTargetShift = targetMotion.color === shiftMotion.color;
  return isTargetShift ? shiftDirection : getOppositeDirection(shiftDirection);
}

function calculateDirection(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput,
  isRadial: boolean
): VectorDirection | null {
  const { blueMotion, redMotion, letter } = input;

  if (letter === "Y" || letter === "Z" || letter === "Y-" || letter === "Z-") {
    return getLetterYZDirection(blueMotion, redMotion, targetMotion, isRadial);
  }

  if (isShiftMotion(targetMotion.motionType)) {
    if (letter === "G" || letter === "H") {
      return getLetterGHDirection(targetMotion.endLocation, targetMotion.color, isRadial);
    }
    if (letter === "I") {
      return getLetterIDirection(targetMotion.endLocation, targetMotion.color, isRadial);
    }
    const otherMotion = targetMotion.color === "blue" ? redMotion : blueMotion;
    if (isShiftMotion(otherMotion.motionType)) {
      const blueDirection = getShiftDirection(
        blueMotion.startLocation,
        blueMotion.endLocation,
        "blue",
        isRadial
      );
      if (!blueDirection) return null;
      return targetMotion.color === "blue"
        ? blueDirection
        : getOppositeDirection(blueDirection);
    }
    return getShiftDirection(
      targetMotion.startLocation,
      targetMotion.endLocation,
      targetMotion.color,
      isRadial
    );
  }

  return getStaticDashDirection(targetMotion.endLocation, targetMotion.color, isRadial);
}

export function calculateBetaOffset(
  input: BetaOffsetInput,
  targetMotion: BetaMotionInput
): { x: number; y: number } {
  const { blueMotion, redMotion, gridMode } = input;

  const blueEndLoc = blueMotion.endLocation.toLowerCase();
  const redEndLoc = redMotion.endLocation.toLowerCase();

  if (blueEndLoc !== redEndLoc) {
    return { x: 0, y: 0 };
  }

  const blueIsHand = blueMotion.propType === "hand";
  const redIsHand = redMotion.propType === "hand";
  const actualBluePropType = blueIsHand
    ? "hand"
    : (input.bluePropType ?? blueMotion.propType ?? "staff");
  const actualRedPropType = redIsHand
    ? "hand"
    : (input.redPropType ?? redMotion.propType ?? "staff");

  const bothAreHands = actualBluePropType === "hand" && actualRedPropType === "hand";

  if (bothAreHands) {
    const distance = getBetaOffsetSize("hand", gridMode);

    const eastPositions = ["e", "ne", "se"];
    const westPositions = ["w", "nw", "sw"];

    const blueStartLoc = blueMotion.startLocation.toLowerCase();
    const redStartLoc = redMotion.startLocation.toLowerCase();

    const blueFromEast = eastPositions.includes(blueStartLoc);
    const blueFromWest = westPositions.includes(blueStartLoc);
    const redFromEast = eastPositions.includes(redStartLoc);
    const redFromWest = westPositions.includes(redStartLoc);

    if (blueFromEast && redFromWest) {
      return targetMotion.color === "blue"
        ? { x: distance, y: 0 }
        : { x: -distance, y: 0 };
    } else if (blueFromWest && redFromEast) {
      return targetMotion.color === "blue"
        ? { x: -distance, y: 0 }
        : { x: distance, y: 0 };
    } else {
      return targetMotion.color === "blue"
        ? { x: -distance, y: 0 }
        : { x: distance, y: 0 };
    }
  }

  const blueEndOri = blueMotion.endOrientation;
  const redEndOri = redMotion.endOrientation;

  const blueIsRadial = isRadialOrientation(blueEndOri);
  const redIsRadial = isRadialOrientation(redEndOri);
  const blueIsNonRadial = isNonRadialOrientation(blueEndOri);
  const redIsNonRadial = isNonRadialOrientation(redEndOri);

  const hybridOrientation =
    (redIsRadial && blueIsNonRadial) || (redIsNonRadial && blueIsRadial);

  if (hybridOrientation) {
    return { x: 0, y: 0 };
  }

  const bothRadial = redIsRadial && blueIsRadial;
  const bothNonRadial = redIsNonRadial && blueIsNonRadial;
  const sameTypeButDifferentOrientation =
    (bothRadial && redEndOri?.toLowerCase() !== blueEndOri?.toLowerCase()) ||
    (bothNonRadial && redEndOri?.toLowerCase() !== blueEndOri?.toLowerCase());

  const bothAreBuugengFamily =
    isBuugengFamilyProp(actualBluePropType) &&
    isBuugengFamilyProp(actualRedPropType);

  if (bothAreBuugengFamily) {
    const blueChirality = input.blueBuugengFlipped ?? false;
    const redChirality = input.redBuugengFlipped ?? false;
    const oppositeChirality = blueChirality !== redChirality; 

    if (oppositeChirality) {
      return { x: 0, y: 0 };
    }
  }

  const actualPropType =
    targetMotion.color === "blue" ? actualBluePropType : actualRedPropType;

  if (sameTypeButDifferentOrientation && isUnilateralProp(actualPropType)) {
    return { x: 0, y: 0 };
  }

  if (sameTypeButDifferentOrientation && actualPropType === "trigeng") {
    return { x: 0, y: 0 };
  }

  const isRadial = isRadialForMapSelection(blueEndOri, redEndOri);
  const direction = calculateDirection(input, targetMotion, isRadial);

  if (!direction) {
    return { x: 0, y: 0 };
  }

  const distance = getBetaOffsetSize(actualPropType, gridMode);
  return directionToOffset(direction, distance);
}
