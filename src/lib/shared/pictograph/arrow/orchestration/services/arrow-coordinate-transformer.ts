/**
 * Arrow Coordinate Transformer
 *
 * Handles coordinate transformations and rotation matrix operations.
 * Responsible for converting between coordinate systems.
 */

export function transformAdjustmentByRotation(
  adjustmentX: number,
  adjustmentY: number,
  rotationDegrees: number
): [number, number] {
  const rotationRadians = (rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(-rotationRadians);
  const sin = Math.sin(-rotationRadians);
  const transformedX = adjustmentX * cos - adjustmentY * sin;
  const transformedY = adjustmentX * sin + adjustmentY * cos;
  return [transformedX, transformedY];
}

export function transformPointByRotation(
  point: { x: number; y: number },
  rotationDegrees: number,
  origin?: { x: number; y: number }
): { x: number; y: number } {
  const originX = origin?.x || 0;
  const originY = origin?.y || 0;
  const translatedX = point.x - originX;
  const translatedY = point.y - originY;
  const [rotatedX, rotatedY] = transformAdjustmentByRotation(
    translatedX,
    translatedY,
    rotationDegrees
  );
  return {
    x: rotatedX + originX,
    y: rotatedY + originY,
  };
}

export function applyRotationMatrix(
  x: number,
  y: number,
  angleDegrees: number
): [number, number] {
  const radians = (angleDegrees * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const rotatedX = x * cos - y * sin;
  const rotatedY = x * sin + y * cos;
  return [rotatedX, rotatedY];
}

export function calculateDistance(
  point1: { x: number; y: number },
  point2: { x: number; y: number }
): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function calculateAngle(
  from: { x: number; y: number },
  to: { x: number; y: number }
): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const radians = Math.atan2(dy, dx);
  const degrees = (radians * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

export function normalizeAngle(degrees: number): number {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}
