import type {
  ColorData,
  TransformationCheckResult,
} from "../../domain/models/internal-step-models";

/**
 * Service for detecting reflection transformations (mirror and flip) between beat pairs.
 * Handles both same-color and swapped-color variants.
 */
export interface IReflectionComparer {
  /**
   * Check for reflection transformations between two steps.
   * @param b1Blue Beat 1 blue prop data
   * @param b1Red Beat 1 red prop data
   * @param b2Blue Beat 2 blue prop data
   * @param b2Red Beat 2 red prop data
   * @returns Detected reflection transformations
   */
  checkReflections(
    b1Blue: ColorData,
    b1Red: ColorData,
    b2Blue: ColorData,
    b2Red: ColorData
  ): TransformationCheckResult;
}
