import { Orientation } from "../../../shared/domain/enums/pictograph-enums";

export type ArrowRotationAnimationDirection = "cw" | "ccw" | "auto";

// Visual SVG angles increase clockwise. Keep the eight relative orientations
// in that order so adjacent Level 6 changes animate by 45 degrees instead of
// falling back to a direction that can take the 315-degree route.
export const ARROW_ORIENTATION_CYCLE: readonly Orientation[] = [
  Orientation.IN,
  Orientation.COUNTER_IN,
  Orientation.COUNTER,
  Orientation.COUNTER_OUT,
  Orientation.OUT,
  Orientation.CLOCK_OUT,
  Orientation.CLOCK,
  Orientation.CLOCK_IN,
];

export function getArrowOrientationTransitionDirection(
  previousOrientation: Orientation,
  nextOrientation: Orientation,
  fallback: Exclude<ArrowRotationAnimationDirection, "auto">
): ArrowRotationAnimationDirection {
  const previousIndex = ARROW_ORIENTATION_CYCLE.indexOf(previousOrientation);
  const nextIndex = ARROW_ORIENTATION_CYCLE.indexOf(nextOrientation);

  if (previousIndex === -1 || nextIndex === -1) return fallback;

  const cycleLength = ARROW_ORIENTATION_CYCLE.length;
  const clockwiseSteps =
    (nextIndex - previousIndex + cycleLength) % cycleLength;
  const counterClockwiseSteps =
    (previousIndex - nextIndex + cycleLength) % cycleLength;

  if (clockwiseSteps === 0) return "auto";
  if (clockwiseSteps === counterClockwiseSteps) return fallback;
  return clockwiseSteps < counterClockwiseSteps ? "cw" : "ccw";
}
