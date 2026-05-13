import type { Point2D } from "./body-rotation-solver";

const SHOULDER_Y_OFFSET = -4;

export function getShoulderPosition(
  side: "left" | "right",
  bodyRotationDeg: number,
  bodyCenter: Point2D,
  shoulderDist: number,
): Point2D {
  const rad = bodyRotationDeg * (Math.PI / 180);
  const sign = side === "left" ? -1 : 1;
  return {
    x: bodyCenter.x + sign * shoulderDist * Math.cos(rad) - SHOULDER_Y_OFFSET * Math.sin(rad),
    y: bodyCenter.y + sign * shoulderDist * Math.sin(rad) + SHOULDER_Y_OFFSET * Math.cos(rad),
  };
}

export function computeReachPercentage(
  shoulder: Point2D,
  prop: Point2D,
  maxReach: number,
): number {
  const dist = Math.hypot(prop.x - shoulder.x, prop.y - shoulder.y);
  return Math.round((dist / maxReach) * 100);
}
