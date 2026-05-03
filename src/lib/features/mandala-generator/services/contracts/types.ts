import type { Point } from "../../domain/models/mandala-element";

/**
 * Result of a single transformation operation.
 */
export interface TransformResult {
  /** Transformed position */
  position: Point;
  /** Transformed rotation angle (degrees) */
  rotation: number;
  /** Scale factor */
  scale: number;
  /** Whether this result is mirrored */
  isMirrored: boolean;
  /** Fold index (0 = original, 1+ = copies) */
  foldIndex: number;
}
