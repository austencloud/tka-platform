/**
 * VTG Terminology Mapper
 *
 * Maps TKA pictograph data to VTG (Vulcan Tech Gospel) terminology.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { RotationDirection } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import { isVisibleMotion } from "$lib/shared/pictograph/shared/domain/models/motion-data";
import { PoiTimingDirection, PoiPatternRatio } from "../domain/poi-enums";
import type { VTGTerminologyMapping } from "../domain/poi-models";

export function deriveVTGTerminology(pictograph: PictographData): VTGTerminologyMapping | null {
  const blue = pictograph.motions?.blue;
  const red = pictograph.motions?.red;

  // Need both hands really there to derive VTG terminology (invisible
  // placeholder = hand not really there under the both-required Step shape)
  if (!isVisibleMotion(blue) || !isVisibleMotion(red)) {
    return null;
  }

  // Derive timing (Together vs Split)
  // Together = both hands at same location (same phase)
  // Split = hands at opposite locations (180° out of phase)
  const isTogether = blue.startLocation === red.startLocation;

  // Derive direction (Same vs Opposite)
  // Compare rotation directions
  const blueDir = blue.rotationDirection;
  const redDir = red.rotationDirection;

  // Both no rotation counts as "same"
  const bothNoRotation =
    blueDir === RotationDirection.NO_ROTATION &&
    redDir === RotationDirection.NO_ROTATION;
  const isSameDirection = bothNoRotation || blueDir === redDir;

  // Map to VTG timing/direction
  let vtgTiming: PoiTimingDirection;
  if (isTogether && isSameDirection) {
    vtgTiming = PoiTimingDirection.TOGETHER_SAME;
  } else if (isTogether && !isSameDirection) {
    vtgTiming = PoiTimingDirection.TOGETHER_OPPOSITE;
  } else if (!isTogether && isSameDirection) {
    vtgTiming = PoiTimingDirection.SPLIT_SAME;
  } else {
    vtgTiming = PoiTimingDirection.SPLIT_OPPOSITE;
  }

  // Derive ratio from average turns
  const blueTurns = typeof blue.turns === "number" ? blue.turns : 1;
  const redTurns = typeof red.turns === "number" ? red.turns : 1;
  const avgTurns = (blueTurns + redTurns) / 2;
  const vtgRatio = getPatternRatio(avgTurns) as PoiPatternRatio;

  return {
    tkaMotionType: `${blue.motionType}/${red.motionType}`,
    vtgTiming,
    vtgRatio,
  };
}

export function getPatternRatio(turns: number): string {
  if (turns <= 1) return PoiPatternRatio.ONE_TO_ONE;
  if (turns <= 3) return PoiPatternRatio.ONE_TO_THREE;
  return PoiPatternRatio.ONE_TO_FIVE;
}
