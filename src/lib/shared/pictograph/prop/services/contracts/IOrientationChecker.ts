/**
 * Orientation Checker Contract
 */

export interface IOrientationChecker {
  /**
   * Check if motion ends with radial orientation (IN/OUT).
   */
  isRadial(): boolean;

  /**
   * Check if motion ends with non-radial orientation (CLOCK/COUNTER).
   */
  isNonRadial(): boolean;
}
