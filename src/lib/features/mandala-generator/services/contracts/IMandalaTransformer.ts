import type {
  Point,
  MandalaElement,
  TransformedElement,
} from "../../domain/models/mandala-element";
import type { MandalaConfig } from "../../domain/models/mandala-config";
import type { SymmetryFold } from "../../domain/enums/mandala-enums";

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

/**
 * Service for applying geometric symmetry transformations to mandala elements.
 * This is the core math engine for the mandala generator.
 */
export interface IMandalaTransformer {
  /**
   * Apply n-fold rotational symmetry to an element.
   * Generates copies rotated around the center point.
   *
   * @param element - Source element to transform
   * @param foldCount - Number of symmetry folds (2, 3, 4, 6, 8, 12)
   * @param center - Center point for rotation
   * @returns Array of transform results (one per fold, including original at index 0)
   */
  applyRotationalSymmetry(
    element: MandalaElement,
    foldCount: SymmetryFold,
    center: Point
  ): TransformResult[];

  /**
   * Apply mirror reflection to an element across a specified axis.
   *
   * @param element - Source element to mirror
   * @param axisAngle - Axis angle in degrees (0 = vertical, 90 = horizontal)
   * @param center - Center point for reflection
   * @returns Transform result for the mirrored copy
   */
  applyMirror(
    element: MandalaElement,
    axisAngle: number,
    center: Point
  ): TransformResult;

  /**
   * Generate full kaleidoscope pattern combining rotation and mirror symmetry.
   * This is the main method for creating complete mandala patterns.
   *
   * @param element - Source element
   * @param config - Full mandala configuration
   * @returns Array of all transformed elements (original + rotated + mirrored copies)
   */
  generateKaleidoscopePattern(
    element: MandalaElement,
    config: MandalaConfig
  ): TransformedElement[];

  /**
   * Transform all source elements according to configuration.
   * Batch version of generateKaleidoscopePattern.
   *
   * @param elements - Array of source elements
   * @param config - Mandala configuration
   * @returns Array of all transformed elements for all sources
   */
  transformAllElements(
    elements: MandalaElement[],
    config: MandalaConfig
  ): TransformedElement[];

  /**
   * Calculate the position of a point after rotation around a center.
   *
   * @param point - Point to rotate
   * @param angleDegrees - Rotation angle in degrees
   * @param center - Center of rotation
   * @returns Rotated point position
   */
  rotatePoint(point: Point, angleDegrees: number, center: Point): Point;

  /**
   * Calculate the position of a point after mirror reflection.
   *
   * @param point - Point to mirror
   * @param axisAngle - Mirror axis angle in degrees
   * @param center - Center point of the axis
   * @returns Mirrored point position
   */
  mirrorPoint(point: Point, axisAngle: number, center: Point): Point;
}
