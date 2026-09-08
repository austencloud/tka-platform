import type {
  ColorData,
  TransformationCheckResult,
} from "../../domain/models/internal-step-models";
import {
  hasRotationData,
  areRotDirsInvertedForRotation,
} from "../comparison/rotation-direction-helpers";

/**
 * Detect pure swap and invert transformations.
 */
export function checkRepeated(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  const isRepeated =
    b1Left.startLoc === b2Left.startLoc &&
    b1Left.endLoc === b2Left.endLoc &&
    b1Left.motionType === b2Left.motionType &&
    b1Right.startLoc === b2Right.startLoc &&
    b1Right.endLoc === b2Right.endLoc &&
    b1Right.motionType === b2Right.motionType;

  if (isRepeated) {
    transformations.push("repeated");
  }

  return { transformations };
}

export function checkSwapInvert(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  // Pure swap check (colors swapped, no position change)
  const colorsSwapped =
    b1Left.startLoc === b2Right.startLoc &&
    b1Left.endLoc === b2Right.endLoc &&
    b1Right.startLoc === b2Left.startLoc &&
    b1Right.endLoc === b2Left.endLoc;

  // Same positions check (for pure inversion)
  const positionsSame =
    b1Left.startLoc === b2Left.startLoc &&
    b1Left.endLoc === b2Left.endLoc &&
    b1Right.startLoc === b2Right.startLoc &&
    b1Right.endLoc === b2Right.endLoc;

  // Rotation direction checks
  const canDetermineRotForSwap = hasRotationData(
    b1Right.propRotDir,
    b1Left.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir,
    b1Right.motionType,
    b1Left.motionType,
    b2Left.motionType,
    b2Right.motionType
  );

  const rotDirSameSwapped =
    b1Right.propRotDir === b2Left.propRotDir &&
    b1Left.propRotDir === b2Right.propRotDir;

  const rotDirInvertedSwappedForRotation = areRotDirsInvertedForRotation(
    b1Right.propRotDir,
    b1Left.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir
  );

  const rotDirInvertedForRotation = areRotDirsInvertedForRotation(
    b1Left.propRotDir,
    b1Right.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir
  );

  // Pure swap (no position change, just colors swapped)
  if (colorsSwapped) {
    if (!canDetermineRotForSwap) {
      if (!transformations.includes("swapped"))
        transformations.push("swapped");
      if (!transformations.includes("swapped_inverted"))
        transformations.push("swapped_inverted");
    } else {
      if (rotDirSameSwapped && !transformations.includes("swapped")) {
        transformations.push("swapped");
      }
      if (
        rotDirInvertedSwappedForRotation &&
        !transformations.includes("swapped_inverted")
      ) {
        transformations.push("swapped_inverted");
      }
    }
  }

  // Pure inversion (same positions, rotation direction changed)
  if (positionsSame && rotDirInvertedForRotation) {
    transformations.push("inverted");
  }

  return { transformations };
}
