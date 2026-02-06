/**
 * Arrow Coordinate Transformer Contract
 *
 * Interface for coordinate transformations and rotation matrix operations.
 */

export interface IArrowCoordinateTransformer {
  /**
   * Transform adjustment coordinates from arrow's local coordinate system to global scene coordinates
   */
  transformAdjustmentByRotation(
    adjustmentX: number,
    adjustmentY: number,
    rotationDegrees: number
  ): [number, number];

  /**
   * Transform point by rotation around origin
   */
  transformPointByRotation(
    point: { x: number; y: number },
    rotationDegrees: number,
    origin?: { x: number; y: number }
  ): { x: number; y: number };

  /**
   * Apply rotation matrix transformation
   */
  applyRotationMatrix(
    x: number,
    y: number,
    angleDegrees: number
  ): [number, number];

  /**
   * Calculate Euclidean distance between two points
   */
  calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
  ): number;

  /**
   * Calculate angle in degrees from one point to another
   */
  calculateAngle(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): number;

  /**
   * Normalize angle to 0-360 range
   */
  normalizeAngle(degrees: number): number;
}
