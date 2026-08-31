import type { ExtractedStep } from "../../domain/models/internal-step-models";
import type { RewoundResult } from "./types";

export function checkRewound(steps: ExtractedStep[]): RewoundResult {
  if (steps.length < 2 || steps.length % 2 !== 0) {
    return { isRewound: false };
  }

  const halfLength = steps.length / 2;

  for (let i = 0; i < halfLength; i++) {
    const forward = steps[i]!;
    const reverse = steps[steps.length - 1 - i]!;

    const leftMatch =
      forward.left.startLoc === reverse.left.endLoc &&
      forward.left.endLoc === reverse.left.startLoc &&
      forward.left.motionType === reverse.left.motionType;

    const rightMatch =
      forward.right.startLoc === reverse.right.endLoc &&
      forward.right.endLoc === reverse.right.startLoc &&
      forward.right.motionType === reverse.right.motionType;

    if (!leftMatch || !rightMatch) {
      return { isRewound: false };
    }
  }

  return { isRewound: true };
}
