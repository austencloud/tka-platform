/**
 * Arrow Coordinate Transformer
 *
 * Handles coordinate transformations and rotation matrix operations.
 * Responsible for converting between coordinate systems.
 */

import type { IArrowCoordinateTransformer } from "../contracts/IArrowCoordinateTransformer";


export class ArrowCoordinateTransformer implements IArrowCoordinateTransformer {
  transformAdjustmentByRotation(
    adjustmentX: number,
    adjustmentY: number,
    rotationDegrees: number
  ): [number, number] {
    /**
     * Transform adjustment coordinates from arrow's local coordinate system to global scene coordinates.
     *
     * The adjustment values are calculated relative to the arrow's orientation, but need to be
     * applied in the global scene coordinate system. This method applies the inverse rotation
     * transformation to convert from local to global coordinates.
     *
     * Args:
     *     adjustmentX: X adjustment in arrow's local coordinate system
     *     adjustmentY: Y adjustment in arrow's local coordinate system
     *     rotationDegrees: Arrow's rotation angle in degrees
     *
     * Returns:
     *     Tuple of [transformedX, transformedY] in global scene coordinates
     */

    // Convert degrees to radians
    const rotationRadians = (rotationDegrees * Math.PI) / 180;

    // Apply rotation matrix transformation
    // For inverse rotation (local to global), we use negative angle
    const cos = Math.cos(-rotationRadians);
    const sin = Math.sin(-rotationRadians);

    // Apply 2D rotation matrix
    const transformedX = adjustmentX * cos - adjustmentY * sin;
    const transformedY = adjustmentX * sin + adjustmentY * cos;

    return [transformedX, transformedY];
  }

  transformPointByRotation(
    point: { x: number; y: number },
    rotationDegrees: number,
    origin?: { x: number; y: number }
  ): { x: number; y: number } {
    /**
     * Transform a point by rotation around an origin.
     *
     * Args:
     *     point: Point to transform
     *     rotationDegrees: Rotation angle in degrees
     *     origin: Origin point for rotation (defaults to 0,0)
     *
     * Returns:
     *     Transformed point
     */
    const originX = origin?.x || 0;
    const originY = origin?.y || 0;

    // Translate to origin
    const translatedX = point.x - originX;
    const translatedY = point.y - originY;

    // Apply rotation
    const [rotatedX, rotatedY] = this.transformAdjustmentByRotation(
      translatedX,
      translatedY,
      rotationDegrees
    );

    // Translate back
    return {
      x: rotatedX + originX,
      y: rotatedY + originY,
    };
  }

  applyRotationMatrix(
    x: number,
    y: number,
    angleDegrees: number
  ): [number, number] {
    /**
     * Apply a 2D rotation matrix to coordinates.
     *
     * Args:
     *     x: X coordinate
     *     y: Y coordinate
     *     angleDegrees: Rotation angle in degrees
     *
     * Returns:
     *     Tuple of [rotatedX, rotatedY]
     */
    const radians = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);

    const rotatedX = x * cos - y * sin;
    const rotatedY = x * sin + y * cos;

    return [rotatedX, rotatedY];
  }

  calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
  ): number {
    /**
     * Calculate Euclidean distance between two points.
     */
    const dx = point2.x - point1.x;
    const dy = point2.y - point1.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  calculateAngle(
    from: { x: number; y: number },
    to: { x: number; y: number }
  ): number {
    /**
     * Calculate angle in degrees from one point to another.
     *
     * Returns:
     *     Angle in degrees (0-360)
     */
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const radians = Math.atan2(dy, dx);
    const degrees = (radians * 180) / Math.PI;

    // Normalize to 0-360 range
    return degrees < 0 ? degrees + 360 : degrees;
  }

  normalizeAngle(degrees: number): number {
    /**
     * Normalize angle to 0-360 range.
     */
    const normalized = degrees % 360;
    return normalized < 0 ? normalized + 360 : normalized;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowCoordinateTransformer to avoid DI container rebuilds.
// ============================================================================

export const arrowCoordinateTransformer = new ArrowCoordinateTransformer();
