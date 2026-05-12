import type { ExtractedStep } from "../../../domain/models/internal-step-models";
import type { RewoundResult } from "./types";

export function checkRewound(steps: ExtractedStep[]): RewoundResult {
  if (steps.length < 2 || steps.length % 2 !== 0) {
    return { isRewound: false };
  }

  const halfLength = steps.length / 2;

  for (let i = 0; i < halfLength; i++) {
    const forward = steps[i]!;
    const reverse = steps[steps.length - 1 - i]!;

    const blueMatch =
      forward.blue.startLoc === reverse.blue.endLoc &&
      forward.blue.endLoc === reverse.blue.startLoc &&
      forward.blue.motionType === reverse.blue.motionType;

    const redMatch =
      forward.red.startLoc === reverse.red.endLoc &&
      forward.red.endLoc === reverse.red.startLoc &&
      forward.red.motionType === reverse.red.motionType;

    if (!blueMatch || !redMatch) {
      return { isRewound: false };
    }
  }

  return { isRewound: true };
}
