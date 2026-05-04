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
} from "../implementations/comparison/rotation-direction-helpers";

/**
 * Detect reflection transformations (mirror and flip) between beat pairs.
 */
export function checkReflections(
  b1Blue: ColorData,
  b1Red: ColorData,
  b2Blue: ColorData,
  b2Red: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  checkSameColorReflections(b1Blue, b1Red, b2Blue, b2Red, transformations);
  checkSwappedColorReflections(b1Blue, b1Red, b2Blue, b2Red, transformations);

  return { transformations };
}

function checkSameColorReflections(
  b1Blue: ColorData,
  b1Red: ColorData,
  b2Blue: ColorData,
  b2Red: ColorData,
  transformations: string[]
): void {
  // Mirror (same colors)
  const positionsMirrored =
    MIRROR_VERTICAL[b1Blue.startLoc] === b2Blue.startLoc &&
    MIRROR_VERTICAL[b1Blue.endLoc] === b2Blue.endLoc &&
    MIRROR_VERTICAL[b1Red.startLoc] === b2Red.startLoc &&
    MIRROR_VERTICAL[b1Red.endLoc] === b2Red.endLoc;

  // Flip (same colors)
  const positionsFlipped =
    FLIP_HORIZONTAL[b1Blue.startLoc] === b2Blue.startLoc &&
    FLIP_HORIZONTAL[b1Blue.endLoc] === b2Blue.endLoc &&
    FLIP_HORIZONTAL[b1Red.startLoc] === b2Red.startLoc &&
    FLIP_HORIZONTAL[b1Red.endLoc] === b2Red.endLoc;

  const canDetermineInversion = hasRotationData(
    b1Blue.propRotDir,
    b1Red.propRotDir,
    b2Blue.propRotDir,
    b2Red.propRotDir,
    b1Blue.motionType,
    b1Red.motionType,
    b2Blue.motionType,
    b2Red.motionType
  );

  // For MIRROR/FLIP: rotation direction naturally FLIPS due to reflection.
  // "Inverted" means rot dir stayed SAME (someone counteracted the natural flip)
  const rotDirInvertedForMirrorFlip = areRotDirsInvertedForMirrorFlip(
    b1Blue.propRotDir,
    b1Red.propRotDir,
    b2Blue.propRotDir,
    b2Red.propRotDir
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
  b1Blue: ColorData,
  b1Red: ColorData,
  b2Blue: ColorData,
  b2Red: ColorData,
  transformations: string[]
): void {
  // Mirrored + swapped
  const positionsMirroredSwapped =
    MIRROR_VERTICAL[b1Red.startLoc] === b2Blue.startLoc &&
    MIRROR_VERTICAL[b1Red.endLoc] === b2Blue.endLoc &&
    MIRROR_VERTICAL[b1Blue.startLoc] === b2Red.startLoc &&
    MIRROR_VERTICAL[b1Blue.endLoc] === b2Red.endLoc;

  // Flipped + swapped
  const positionsFlippedSwapped =
    FLIP_HORIZONTAL[b1Red.startLoc] === b2Blue.startLoc &&
    FLIP_HORIZONTAL[b1Red.endLoc] === b2Blue.endLoc &&
    FLIP_HORIZONTAL[b1Blue.startLoc] === b2Red.startLoc &&
    FLIP_HORIZONTAL[b1Blue.endLoc] === b2Red.endLoc;

  // Motion type checks for swapped colors
  const motionTypesSameSwapped =
    b1Red.motionType === b2Blue.motionType &&
    b1Blue.motionType === b2Red.motionType;

  // Check if motion types are actually invertible (pro/anti only)
  const hasInvertibleMotionTypes =
    (b1Red.motionType === "pro" || b1Red.motionType === "anti") &&
    (b1Blue.motionType === "pro" || b1Blue.motionType === "anti") &&
    (b2Blue.motionType === "pro" || b2Blue.motionType === "anti") &&
    (b2Red.motionType === "pro" || b2Red.motionType === "anti");

  const motionTypesInvertedSwapped =
    hasInvertibleMotionTypes &&
    invertMotionType(b1Red.motionType) === b2Blue.motionType &&
    invertMotionType(b1Blue.motionType) === b2Red.motionType;

  if (positionsMirroredSwapped) {
    processSwappedReflection(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red,
      motionTypesSameSwapped,
      motionTypesInvertedSwapped,
      hasInvertibleMotionTypes,
      "mirrored",
      transformations
    );
  }

  if (positionsFlippedSwapped) {
    processSwappedReflection(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red,
      motionTypesSameSwapped,
      motionTypesInvertedSwapped,
      hasInvertibleMotionTypes,
      "flipped",
      transformations
    );
  }
}

function processSwappedReflection(
  b1Blue: ColorData,
  b1Red: ColorData,
  b2Blue: ColorData,
  b2Red: ColorData,
  motionTypesSameSwapped: boolean,
  motionTypesInvertedSwapped: boolean,
  hasInvertibleMotionTypes: boolean,
  baseName: string,
  transformations: string[]
): void {
  const canDetermineRotInversion = hasRotationData(
    b1Red.propRotDir,
    b1Blue.propRotDir,
    b2Blue.propRotDir,
    b2Red.propRotDir,
    b1Red.motionType,
    b1Blue.motionType,
    b2Blue.motionType,
    b2Red.motionType
  );

  const rotDirInvertedForSwap =
    canDetermineRotInversion &&
    areRotDirsInvertedForMirrorFlip(
      b1Red.propRotDir,
      b1Blue.propRotDir,
      b2Blue.propRotDir,
      b2Red.propRotDir
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
    b1Red.motionType === b2Blue.motionType &&
    b1Blue.motionType === b2Red.motionType
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
