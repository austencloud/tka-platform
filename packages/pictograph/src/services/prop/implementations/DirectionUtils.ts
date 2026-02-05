import type { MotionData } from "@tka/types";
import { VectorDirection } from "@tka/types";

const OPPOSITE_DIRECTIONS: Record<VectorDirection, VectorDirection> = {
  [VectorDirection.UP]: VectorDirection.DOWN,
  [VectorDirection.DOWN]: VectorDirection.UP,
  [VectorDirection.LEFT]: VectorDirection.RIGHT,
  [VectorDirection.RIGHT]: VectorDirection.LEFT,
  [VectorDirection.UPRIGHT]: VectorDirection.DOWNLEFT,
  [VectorDirection.DOWNLEFT]: VectorDirection.UPRIGHT,
  [VectorDirection.UPLEFT]: VectorDirection.DOWNRIGHT,
  [VectorDirection.DOWNRIGHT]: VectorDirection.UPLEFT,
};

export function getOppositeDirection(
  direction: VectorDirection
): VectorDirection {
  return OPPOSITE_DIRECTIONS[direction];
}

export function getEndLocation(motionData: MotionData): string {
  return motionData.endLocation ?? "";
}
