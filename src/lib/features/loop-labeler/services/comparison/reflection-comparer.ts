import type {
  ColorData,
  TransformationCheckResult,
} from "../../domain/models/internal-step-models";
import {
  MIRROR_VERTICAL,
  FLIP_HORIZONTAL,
} from "../../domain/constants/transformation-maps";
import {
  hasRotationData,
  areRotDirsInvertedForMirrorFlip,
  invertMotionType,
} from "../comparison/rotation-direction-helpers";

/**
 * Detect reflection transformations (mirror and flip) between beat pairs.
 */
export function checkReflections(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  checkSameColorReflections(b1Left, b1Right, b2Left, b2Right, transformations);
  checkSwappedColorReflections(b1Left, b1Right, b2Left, b2Right, transformations);

  return { transformations };
}

function checkSameColorReflections(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData,
  transformations: string[]
): void {
  // Mirror (same colors)
  const positionsMirrored =
    MIRROR_VERTICAL[b1Left.startLoc] === b2Left.startLoc &&
    MIRROR_VERTICAL[b1Left.endLoc] === b2Left.endLoc &&
    MIRROR_VERTICAL[b1Right.startLoc] === b2Right.startLoc &&
    MIRROR_VERTICAL[b1Right.endLoc] === b2Right.endLoc;

  // Flip (same colors)
  const positionsFlipped =
    FLIP_HORIZONTAL[b1Left.startLoc] === b2Left.startLoc &&
    FLIP_HORIZONTAL[b1Left.endLoc] === b2Left.endLoc &&
    FLIP_HORIZONTAL[b1Right.startLoc] === b2Right.startLoc &&
    FLIP_HORIZONTAL[b1Right.endLoc] === b2Right.endLoc;

  const canDetermineInversion = hasRotationData(
    b1Left.propRotDir,
    b1Right.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir,
    b1Left.motionType,
    b1Right.motionType,
    b2Left.motionType,
    b2Right.motionType
  );

  // For MIRROR/FLIP: rotation direction naturally FLIPS due to reflection.
  // "Inverted" means rot dir stayed SAME (someone counteracted the natural flip)
  const rotDirInvertedForMirrorFlip = areRotDirsInvertedForMirrorFlip(
    b1Left.propRotDir,
    b1Right.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir
  );

  if (positionsMirrored) {
    if (!canDetermineInversion) {
      transformations.push("mirrored");
      transformations.push("mirrored_inverted");
    } else if (!rotDirInvertedForMirrorFlip) {
      transformations.push("mirrored");
    } else {
      transformations.push("mirrored_inverted");
    }
  }

  if (positionsFlipped) {
    if (!canDetermineInversion) {
      transformations.push("flipped");
      transformations.push("flipped_inverted");
    } else if (!rotDirInvertedForMirrorFlip) {
      transformations.push("flipped");
    } else {
      transformations.push("flipped_inverted");
    }
  }
}

function checkSwappedColorReflections(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData,
  transformations: string[]
): void {
  // Mirrored + swapped
  const positionsMirroredSwapped =
    MIRROR_VERTICAL[b1Right.startLoc] === b2Left.startLoc &&
    MIRROR_VERTICAL[b1Right.endLoc] === b2Left.endLoc &&
    MIRROR_VERTICAL[b1Left.startLoc] === b2Right.startLoc &&
    MIRROR_VERTICAL[b1Left.endLoc] === b2Right.endLoc;

  // Flipped + swapped
  const positionsFlippedSwapped =
    FLIP_HORIZONTAL[b1Right.startLoc] === b2Left.startLoc &&
    FLIP_HORIZONTAL[b1Right.endLoc] === b2Left.endLoc &&
    FLIP_HORIZONTAL[b1Left.startLoc] === b2Right.startLoc &&
    FLIP_HORIZONTAL[b1Left.endLoc] === b2Right.endLoc;

  // Motion type checks for swapped colors
  const motionTypesSameSwapped =
    b1Right.motionType === b2Left.motionType &&
    b1Left.motionType === b2Right.motionType;

  // Check if motion types are actually invertible (pro/anti only)
  const hasInvertibleMotionTypes =
    (b1Right.motionType === "pro" || b1Right.motionType === "anti") &&
    (b1Left.motionType === "pro" || b1Left.motionType === "anti") &&
    (b2Left.motionType === "pro" || b2Left.motionType === "anti") &&
    (b2Right.motionType === "pro" || b2Right.motionType === "anti");

  const motionTypesInvertedSwapped =
    hasInvertibleMotionTypes &&
    invertMotionType(b1Right.motionType) === b2Left.motionType &&
    invertMotionType(b1Left.motionType) === b2Right.motionType;

  if (positionsMirroredSwapped) {
    processSwappedReflection(
      b1Left,
      b1Right,
      b2Left,
      b2Right,
      motionTypesSameSwapped,
      motionTypesInvertedSwapped,
      hasInvertibleMotionTypes,
      "mirrored",
      transformations
    );
  }

  if (positionsFlippedSwapped) {
    processSwappedReflection(
      b1Left,
      b1Right,
      b2Left,
      b2Right,
      motionTypesSameSwapped,
      motionTypesInvertedSwapped,
      hasInvertibleMotionTypes,
      "flipped",
      transformations
    );
  }
}

function processSwappedReflection(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData,
  motionTypesSameSwapped: boolean,
  motionTypesInvertedSwapped: boolean,
  hasInvertibleMotionTypes: boolean,
  baseName: string,
  transformations: string[]
): void {
  const canDetermineRotInversion = hasRotationData(
    b1Right.propRotDir,
    b1Left.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir,
    b1Right.motionType,
    b1Left.motionType,
    b2Left.motionType,
    b2Right.motionType
  );

  const rotDirInvertedForSwap =
    canDetermineRotInversion &&
    areRotDirsInvertedForMirrorFlip(
      b1Right.propRotDir,
      b1Left.propRotDir,
      b2Left.propRotDir,
      b2Right.propRotDir
    );

  if (motionTypesInvertedSwapped) {
    transformations.push(`${baseName}_swapped_inverted`);
  } else if (motionTypesSameSwapped) {
    if (!canDetermineRotInversion) {
      transformations.push(`${baseName}_swapped`);
      transformations.push(`${baseName}_swapped_inverted`);
    } else if (rotDirInvertedForSwap) {
      transformations.push(`${baseName}_swapped_inverted`);
    } else {
      transformations.push(`${baseName}_swapped`);
    }
  } else if (
    !hasInvertibleMotionTypes &&
    b1Right.motionType === b2Left.motionType &&
    b1Left.motionType === b2Right.motionType
  ) {
    if (!canDetermineRotInversion) {
      transformations.push(`${baseName}_swapped`);
      transformations.push(`${baseName}_swapped_inverted`);
    } else if (rotDirInvertedForSwap) {
      transformations.push(`${baseName}_swapped_inverted`);
    } else {
      transformations.push(`${baseName}_swapped`);
    }
  }
}
