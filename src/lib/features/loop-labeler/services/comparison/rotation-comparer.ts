import type {
  ColorData,
  TransformationCheckResult,
} from "../../domain/models/internal-step-models";
import {
  ROTATE_180,
  ROTATE_90_CCW,
  ROTATE_90_CW,
} from "../../domain/constants/transformation-maps";
import {
  hasRotationData,
  areRotDirsInvertedForRotation,
} from "../comparison/rotation-direction-helpers";

/**
 * Detect rotation transformations between beat pairs.
 */
export function checkRotations(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData
): TransformationCheckResult {
  const transformations: string[] = [];

  checkSameColorRotations(b1Left, b1Right, b2Left, b2Right, transformations);
  checkSwappedColorRotations(b1Left, b1Right, b2Left, b2Right, transformations);

  return { transformations };
}

function checkSameColorRotations(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData,
  transformations: string[]
): void {
  // Position checks for same colors
  const positions90CCW =
    ROTATE_90_CCW[b1Left.startLoc] === b2Left.startLoc &&
    ROTATE_90_CCW[b1Left.endLoc] === b2Left.endLoc &&
    ROTATE_90_CCW[b1Right.startLoc] === b2Right.startLoc &&
    ROTATE_90_CCW[b1Right.endLoc] === b2Right.endLoc;

  const positions180 =
    ROTATE_180[b1Left.startLoc] === b2Left.startLoc &&
    ROTATE_180[b1Left.endLoc] === b2Left.endLoc &&
    ROTATE_180[b1Right.startLoc] === b2Right.startLoc &&
    ROTATE_180[b1Right.endLoc] === b2Right.endLoc;

  const positions90CW =
    ROTATE_90_CW[b1Left.startLoc] === b2Left.startLoc &&
    ROTATE_90_CW[b1Left.endLoc] === b2Left.endLoc &&
    ROTATE_90_CW[b1Right.startLoc] === b2Right.startLoc &&
    ROTATE_90_CW[b1Right.endLoc] === b2Right.endLoc;

  // Rotation direction checks
  const rotDirSameColors =
    b1Left.propRotDir === b2Left.propRotDir &&
    b1Right.propRotDir === b2Right.propRotDir;

  const rotDirInvertedForRotation = areRotDirsInvertedForRotation(
    b1Left.propRotDir,
    b1Right.propRotDir,
    b2Left.propRotDir,
    b2Right.propRotDir
  );

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

  // Check each rotation type
  if (positions90CCW) {
    if (!canDetermineInversion) {
      transformations.push("rotated_90_ccw");
      transformations.push("rotated_90_ccw_inverted");
    } else if (rotDirSameColors) {
      transformations.push("rotated_90_ccw");
    } else if (rotDirInvertedForRotation) {
      transformations.push("rotated_90_ccw_inverted");
    }
  }

  if (positions180) {
    if (!canDetermineInversion) {
      transformations.push("rotated_180");
      transformations.push("rotated_180_inverted");
    } else if (rotDirSameColors) {
      transformations.push("rotated_180");
    } else if (rotDirInvertedForRotation) {
      transformations.push("rotated_180_inverted");
    }
  }

  if (positions90CW) {
    if (!canDetermineInversion) {
      transformations.push("rotated_90_cw");
      transformations.push("rotated_90_cw_inverted");
    } else if (rotDirSameColors) {
      transformations.push("rotated_90_cw");
    } else if (rotDirInvertedForRotation) {
      transformations.push("rotated_90_cw_inverted");
    }
  }
}

function checkSwappedColorRotations(
  b1Left: ColorData,
  b1Right: ColorData,
  b2Left: ColorData,
  b2Right: ColorData,
  transformations: string[]
): void {
  // Position checks for swapped colors
  const positions180Swapped =
    ROTATE_180[b1Right.startLoc] === b2Left.startLoc &&
    ROTATE_180[b1Right.endLoc] === b2Left.endLoc &&
    ROTATE_180[b1Left.startLoc] === b2Right.startLoc &&
    ROTATE_180[b1Left.endLoc] === b2Right.endLoc;

  const positions90CCWSwapped =
    ROTATE_90_CCW[b1Right.startLoc] === b2Left.startLoc &&
    ROTATE_90_CCW[b1Right.endLoc] === b2Left.endLoc &&
    ROTATE_90_CCW[b1Left.startLoc] === b2Right.startLoc &&
    ROTATE_90_CCW[b1Left.endLoc] === b2Right.endLoc;

  const positions90CWSwapped =
    ROTATE_90_CW[b1Right.startLoc] === b2Left.startLoc &&
    ROTATE_90_CW[b1Right.endLoc] === b2Left.endLoc &&
    ROTATE_90_CW[b1Left.startLoc] === b2Right.startLoc &&
    ROTATE_90_CW[b1Left.endLoc] === b2Right.endLoc;

  // Rotation direction checks for swapped colors
  const rotDirSameSwapped =
    b1Right.propRotDir === b2Left.propRotDir &&
    b1Left.propRotDir === b2Right.propRotDir;

  const rotDirInvertedSwappedForRotation = areRotDirsInvertedForRotation(
    b1Right.propRotDir,
    b1Left.propRotDir, // swapped: red→blue, blue→red
    b2Left.propRotDir,
    b2Right.propRotDir
  );

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

  if (positions180Swapped) {
    if (!canDetermineRotForSwap) {
      transformations.push("rotated_180_swapped");
      transformations.push("rotated_180_swapped_inverted");
    } else if (rotDirSameSwapped) {
      transformations.push("rotated_180_swapped");
    } else if (rotDirInvertedSwappedForRotation) {
      transformations.push("rotated_180_swapped_inverted");
    }
  }

  if (positions90CCWSwapped) {
    if (!canDetermineRotForSwap) {
      transformations.push("rotated_90_ccw_swapped");
      transformations.push("rotated_90_ccw_swapped_inverted");
    } else if (rotDirSameSwapped) {
      transformations.push("rotated_90_ccw_swapped");
    } else if (rotDirInvertedSwappedForRotation) {
      transformations.push("rotated_90_ccw_swapped_inverted");
    }
  }

  if (positions90CWSwapped) {
    if (!canDetermineRotForSwap) {
      transformations.push("rotated_90_cw_swapped");
      transformations.push("rotated_90_cw_swapped_inverted");
    } else if (rotDirSameSwapped) {
      transformations.push("rotated_90_cw_swapped");
    } else if (rotDirInvertedSwappedForRotation) {
      transformations.push("rotated_90_cw_swapped_inverted");
    }
  }
}
