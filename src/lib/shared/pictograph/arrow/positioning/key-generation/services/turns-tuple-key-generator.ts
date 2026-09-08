/**
 * Turns Tuple Key Generator
 * Generates turns tuple array matching advanced lookup expectations.
 */

import type { PictographData } from "../../../../shared/domain/models/pictograph-data";

function getTurns(value: unknown): number {
  if (typeof value === "number") return value;
  return 0;
}

export function generateTurnsTuple(pictographData: PictographData): number[] {
  try {
    const leftTurns = getTurns(pictographData.motions.left?.turns);
    const rightTurns = getTurns(pictographData.motions.right?.turns);
    return [leftTurns, rightTurns];
  } catch {
    return [0, 0];
  }
}
