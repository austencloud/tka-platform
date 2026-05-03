import type {
  ColorData,
  TransformationCheckResult,
} from "../../../domain/models/internal-step-models";
import {
  ROTATE_180,
  ROTATE_90_CCW,
  ROTATE_90_CW,
} from "../../../domain/constants/transformation-maps";
import {
  hasRotationData,
  areRotDirsInvertedForRotation,
} from "./rotation-direction-helpers";

/**
 * Service for detecting rotation transformations between beat pairs.
 */
export class RotationComparer {
  checkRotations(
    b1Blue: ColorData,
    b1Red: ColorData,
    b2Blue: ColorData,
    b2Red: ColorData
  ): TransformationCheckResult {
    const transformations: string[] = [];

    // Same-color rotation checks
    this.checkSameColorRotations(b1Blue, b1Red, b2Blue, b2Red, transformations);

    // Swapped-color rotation checks
    this.checkSwappedColorRotations(
      b1Blue,
      b1Red,
      b2Blue,
      b2Red,
      transformations
    );

    return { transformations };
  }

  private checkSameColorRotations(
    b1Blue: ColorData,
    b1Red: ColorData,
    b2Blue: ColorData,
    b2Red: ColorData,
    transformations: string[]
  ): void {
    // Position checks for same colors
    const positions90CCW =
      ROTATE_90_CCW[b1Blue.startLoc] === b2Blue.startLoc &&
      ROTATE_90_CCW[b1Blue.endLoc] === b2Blue.endLoc &&
      ROTATE_90_CCW[b1Red.startLoc] === b2Red.startLoc &&
      ROTATE_90_CCW[b1Red.endLoc] === b2Red.endLoc;

    const positions180 =
      ROTATE_180[b1Blue.startLoc] === b2Blue.startLoc &&
      ROTATE_180[b1Blue.endLoc] === b2Blue.endLoc &&
      ROTATE_180[b1Red.startLoc] === b2Red.startLoc &&
      ROTATE_180[b1Red.endLoc] === b2Red.endLoc;

    const positions90CW =
      ROTATE_90_CW[b1Blue.startLoc] === b2Blue.startLoc &&
      ROTATE_90_CW[b1Blue.endLoc] === b2Blue.endLoc &&
      ROTATE_90_CW[b1Red.startLoc] === b2Red.startLoc &&
      ROTATE_90_CW[b1Red.endLoc] === b2Red.endLoc;

    // Rotation direction checks
    const rotDirSameColors =
      b1Blue.propRotDir === b2Blue.propRotDir &&
      b1Red.propRotDir === b2Red.propRotDir;

    const rotDirInvertedForRotation = areRotDirsInvertedForRotation(
      b1Blue.propRotDir,
      b1Red.propRotDir,
      b2Blue.propRotDir,
      b2Red.propRotDir
    );

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

  private checkSwappedColorRotations(
    b1Blue: ColorData,
    b1Red: ColorData,
    b2Blue: ColorData,
    b2Red: ColorData,
    transformations: string[]
  ): void {
    // Position checks for swapped colors
    const positions180Swapped =
      ROTATE_180[b1Red.startLoc] === b2Blue.startLoc &&
      ROTATE_180[b1Red.endLoc] === b2Blue.endLoc &&
      ROTATE_180[b1Blue.startLoc] === b2Red.startLoc &&
      ROTATE_180[b1Blue.endLoc] === b2Red.endLoc;

    const positions90CCWSwapped =
      ROTATE_90_CCW[b1Red.startLoc] === b2Blue.startLoc &&
      ROTATE_90_CCW[b1Red.endLoc] === b2Blue.endLoc &&
      ROTATE_90_CCW[b1Blue.startLoc] === b2Red.startLoc &&
      ROTATE_90_CCW[b1Blue.endLoc] === b2Red.endLoc;

    const positions90CWSwapped =
      ROTATE_90_CW[b1Red.startLoc] === b2Blue.startLoc &&
      ROTATE_90_CW[b1Red.endLoc] === b2Blue.endLoc &&
      ROTATE_90_CW[b1Blue.startLoc] === b2Red.startLoc &&
      ROTATE_90_CW[b1Blue.endLoc] === b2Red.endLoc;

    // Rotation direction checks for swapped colors
    const rotDirSameSwapped =
      b1Red.propRotDir === b2Blue.propRotDir &&
      b1Blue.propRotDir === b2Red.propRotDir;

    const rotDirInvertedSwappedForRotation = areRotDirsInvertedForRotation(
      b1Red.propRotDir,
      b1Blue.propRotDir, // swapped: red→blue, blue→red
      b2Blue.propRotDir,
      b2Red.propRotDir
    );

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
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================

export const rotationComparer = new RotationComparer();
