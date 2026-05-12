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
  b1Blue: ColorData,
  b1Red: ColorData,
  b2Blue: ColorData,
  b2Red: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  const isRepeated =
    b1Blue.startLoc === b2Blue.startLoc &&
    b1Blue.endLoc === b2Blue.endLoc &&
    b1Blue.motionType === b2Blue.motionType &&
    b1Red.startLoc === b2Red.startLoc &&
    b1Red.endLoc === b2Red.endLoc &&
    b1Red.motionType === b2Red.motionType;

  if (isRepeated) {
    transformations.push("repeated");
  }

  return { transformations };
}

export function checkSwapInvert(
  b1Blue: ColorData,
  b1Red: ColorData,
  b2Blue: ColorData,
  b2Red: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  // Pure swap check (colors swapped, no position change)
  const colorsSwapped =
    b1Blue.startLoc === b2Red.startLoc &&
    b1Blue.endLoc === b2Red.endLoc &&
    b1Red.startLoc === b2Blue.startLoc &&
    b1Red.endLoc === b2Blue.endLoc;

  // Same positions check (for pure inversion)
  const positionsSame =
    b1Blue.startLoc === b2Blue.startLoc &&
    b1Blue.endLoc === b2Blue.endLoc &&
    b1Red.startLoc === b2Red.startLoc &&
    b1Red.endLoc === b2Red.endLoc;

  // Rotation direction checks
  const canDetermineRotForSwap = hasRotationData(
    b1Red.propRotDir,
    b1Blue.propRotDir,
    b2Blue.propRotDir,
    b2Red.propRotDir,
    b1Red.motionType,
    b1Blue.motionType,
    b2Blue.motionType,
    b2Red.motionType
  );

  const rotDirSameSwapped =
    b1Red.propRotDir === b2Blue.propRotDir &&
    b1Blue.propRotDir === b2Red.propRotDir;

  const rotDirInvertedSwappedForRotation = areRotDirsInvertedForRotation(
    b1Red.propRotDir,
    b1Blue.propRotDir,
    b2Blue.propRotDir,
    b2Red.propRotDir
  );

  const rotDirInvertedForRotation = areRotDirsInvertedForRotation(
    b1Blue.propRotDir,
    b1Red.propRotDir,
    b2Blue.propRotDir,
    b2Red.propRotDir
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
