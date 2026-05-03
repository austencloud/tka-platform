/**
 * Sequence Data Provider Types
 *
 * Co-exported types for the sequence data provider system.
 */

/**
 * Data for a single letter variation (one row in the CSV).
 */
export interface LetterVariationData {
  /** The letter */
  letter: string;
  /** Start position (e.g., "alpha1", "beta3") */
  startPosition: string;
  /** End position */
  endPosition: string;
  /** Blue motion type */
  blueMotionType: string;
  /** Blue start location */
  blueStartLocation: string;
  /** Blue end location */
  blueEndLocation: string;
  /** Blue rotation direction */
  blueRotationDirection: string;
  /** Red motion type */
  redMotionType: string;
  /** Red start location */
  redStartLocation: string;
  /** Red end location */
  redEndLocation: string;
  /** Red rotation direction */
  redRotationDirection: string;
  /** Grid mode (diamond, box, skewed) */
  gridMode?: string;
}
