/**
 * Sequence Loopability Checker
 *
 * Determines if a sequence can loop seamlessly by checking BOTH:
 * 1. Position: last step ends where the sequence begins
 * 2. Orientations: both props end with the same orientation they started with
 *
 * A sequence that returns to its starting position but with different
 * orientations would cause a visible jump at the loop boundary.
 *
 * Supports three data shapes:
 * - Full data (startPosition object with gridPosition + motions)
 * - Step-level grid positions (startPosition/endPosition on steps)
 * - Motion-level locations only (startLocation/endLocation on motions)
 *   Common for URL-decoded/hydrated sequences where grid positions
 *   haven't been derived.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { HandSide } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

/** Treat invisible placeholders like the old absent hand. */
function visibleOrUndefined(m: MotionData | undefined): MotionData | undefined {
  return isVisibleMotion(m) ? m : undefined;
}

/**
 * Check if a sequence can loop seamlessly - position AND orientation must match.
 *
 * Even when isCircular is set (meaning the extension code built a full cycle),
 * we still verify orientations match. A positional cycle doesn't guarantee an
 * orientation cycle. For example, 8 beats of ΔROW returns to alpha1 but with
 * red orientation "out" instead of the starting "in".
 */
export function isSeamlesslyLoopable(sequence: SequenceData): boolean {
  if (!analyzePositionCircularity(sequence)) {
    return false;
  }

  return analyzeOrientationCircularity(sequence);
}

/**
 * Check if the sequence ends where it begins, positionally.
 *
 * Tries three strategies in order:
 * 1. Grid position on the dedicated startPosition object
 * 2. Grid position on the first/last steps (startPosition/endPosition fields)
 * 3. Per-hand motion locations (startLocation/endLocation on motions)
 */
function analyzePositionCircularity(sequence: SequenceData): boolean {
  const steps = sequence.steps;
  if (!steps || steps.length < 1) return false;

  const startPosData = sequence.startPosition ?? sequence.startingPosition;
  const lastStep = steps[steps.length - 1];

  // Strategy 1 & 2: Compare grid positions (e.g. "alpha1" === "alpha1")
  const startGridPos: GridPosition | null | undefined =
    startPosData?.startPosition ??
    startPosData?.gridPosition ??
    steps[0]?.startPosition;
  const endGridPos = lastStep?.endPosition;

  if (startGridPos && endGridPos) {
    return startGridPos === endGridPos;
  }

  // Strategy 3: Compare per-hand motion locations.
  // If both hands end where they started, the position is circular.
  return analyzeLocationCircularity(sequence);
}

/**
 * Compare per-hand start/end locations when grid positions are unavailable.
 * Checks that each prop's endLocation on the last step matches its
 * startLocation on the first step.
 */
function analyzeLocationCircularity(sequence: SequenceData): boolean {
  const steps = sequence.steps;
  if (!steps || steps.length < 1) return false;

  const firstStep = steps[0];
  const lastStep = steps[steps.length - 1];
  if (!firstStep?.motions || !lastStep?.motions) return false;

  // Invisible placeholder = hand not really there (both-required Step shape):
  // it must vacuously pass exactly like the old absent hand.
  const firstLeft = visibleOrUndefined(firstStep.motions[HandSide.LEFT]);
  const firstRight = visibleOrUndefined(firstStep.motions[HandSide.RIGHT]);
  const lastLeft = visibleOrUndefined(lastStep.motions[HandSide.LEFT]);
  const lastRight = visibleOrUndefined(lastStep.motions[HandSide.RIGHT]);

  // Need at least one prop with location data to make a determination
  const hasLeftData = firstLeft?.startLocation && lastLeft?.endLocation;
  const hasRightData = firstRight?.startLocation && lastRight?.endLocation;
  if (!hasLeftData && !hasRightData) return false;

  // Every prop that has data must match
  if (hasLeftData && firstLeft!.startLocation !== lastLeft!.endLocation) {
    return false;
  }
  if (hasRightData && firstRight!.startLocation !== lastRight!.endLocation) {
    return false;
  }

  return true;
}

/**
 * Check if the last step's end orientations match the starting orientations.
 *
 * Compares each prop's endOrientation on the last step against the starting
 * orientation. Uses the dedicated startPosition's motions when available,
 * otherwise falls back to the first step's startOrientation (which carries
 * the same information - where the props were when the sequence began).
 */
function analyzeOrientationCircularity(sequence: SequenceData): boolean {
  const steps = sequence.steps;
  if (!steps || steps.length < 1) return false;

  const lastStep = steps[steps.length - 1];
  if (!lastStep?.motions) return false;

  const firstStep = steps[0];
  if (!firstStep?.motions) return false;

  const startPosData = sequence.startPosition ?? sequence.startingPosition;

  // Get the starting orientation for each prop. The start position's
  // endOrientation equals the first step's startOrientation (props are
  // stationary in the start position). Fall back to first step when
  // start position data is missing.
  const startLeftOri = getStartOrientation(
    visibleOrUndefined(startPosData?.motions?.[HandSide.LEFT]),
    visibleOrUndefined(firstStep.motions[HandSide.LEFT])
  );
  const startRightOri = getStartOrientation(
    visibleOrUndefined(startPosData?.motions?.[HandSide.RIGHT]),
    visibleOrUndefined(firstStep.motions[HandSide.RIGHT])
  );

  const endLeft = visibleOrUndefined(lastStep.motions[HandSide.LEFT]);
  const endRight = visibleOrUndefined(lastStep.motions[HandSide.RIGHT]);

  // Compare blue prop orientation
  if (startLeftOri != null && endLeft) {
    if (startLeftOri !== endLeft.endOrientation) return false;
  }

  // Compare red prop orientation
  if (startRightOri != null && endRight) {
    if (startRightOri !== endRight.endOrientation) return false;
  }

  return true;
}

/**
 * Resolve the starting orientation for a prop. Prefers the start position's
 * endOrientation (canonical), falls back to the first step's startOrientation.
 */
function getStartOrientation(
  startPosMotion: MotionData | undefined,
  firstStepMotion: MotionData | undefined
): string | undefined {
  return startPosMotion?.endOrientation ?? firstStepMotion?.startOrientation;
}
