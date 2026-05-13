import type { Point2D } from "./body-rotation-solver";

const ENDPOINT_MARGIN = 0.05;

export function detectCrossing(
  armLStart: Point2D,
  armLEnd: Point2D,
  armRStart: Point2D,
  armREnd: Point2D,
): Point2D | null {
  const x1 = armLStart.x, y1 = armLStart.y;
  const x2 = armLEnd.x, y2 = armLEnd.y;
  const x3 = armRStart.x, y3 = armRStart.y;
  const x4 = armREnd.x, y4 = armREnd.y;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 0.01) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t > ENDPOINT_MARGIN && t < 1 - ENDPOINT_MARGIN &&
      u > ENDPOINT_MARGIN && u < 1 - ENDPOINT_MARGIN) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1),
    };
  }
  return null;
}
