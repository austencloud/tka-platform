import type {
  ColorData,
  TransformationCheckResult,
} from "../../domain/models/internal-step-models";

/**
 * Service for detecting pure swap and invert transformations between beat pairs.
 * These are transformations without position changes (or with only color swapping).
 */
export interface ISwapInvertComparer {
  /**
   * Check for swap and invert transformations between two steps.
   * @param b1Blue Beat 1 blue prop data
   * @param b1Red Beat 1 red prop data
   * @param b2Blue Beat 2 blue prop data
   * @param b2Red Beat 2 red prop data
   * @returns Detected swap/invert transformations
   */
  checkSwapInvert(
    b1Blue: ColorData,
    b1Red: ColorData,
    b2Blue: ColorData,
    b2Red: ColorData
  ): TransformationCheckResult;

  /**
   * Check if two steps are identical (repeated).
   */
  checkRepeated(
    b1Blue: ColorData,
    b1Red: ColorData,
    b2Blue: ColorData,
    b2Red: ColorData
  ): TransformationCheckResult;
}
