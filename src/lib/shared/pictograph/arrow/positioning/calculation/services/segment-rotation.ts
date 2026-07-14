import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { Orientation } from "../../../../shared/domain/enums/pictograph-enums";
import { orientationToStaffAngle } from "$lib/shared/render/core/calculations/orientation-angle";

/**
 * Diamond hand-point coordinates in the 950 pictograph viewBox (SVG y-down),
 * from the calibrated grid (see LiftedTurnFrame's grid dots). CENTER has no
 * radial direction; a dash half at center uses the pre-dash cardinal for its
 * center-path reference (handled in centerPathAngleFor).
 */
const CENTER = 475;
const GRID_POINT: Partial<Record<GridLocation, { x: number; y: number }>> = {
  [GridLocation.NORTH]: { x: 475, y: 331.9 },
  [GridLocation.EAST]: { x: 618.1, y: 475 },
  [GridLocation.SOUTH]: { x: 475, y: 618.1 },
  [GridLocation.WEST]: { x: 331.9, y: 475 },
  [GridLocation.NORTHEAST]: { x: 618.1, y: 331.9 },
  [GridLocation.SOUTHEAST]: { x: 618.1, y: 618.1 },
  [GridLocation.SOUTHWEST]: { x: 331.9, y: 618.1 },
  [GridLocation.NORTHWEST]: { x: 331.9, y: 331.9 },
};

/**
 * The center-path angle (radians) for a hand at `location`, i.e. the direction
 * from grid center to the hand, in the engine's convention. For a center
 * location (dash midpoint) there is no outward direction; fall back to the
 * supplied cardinal reference (the pre-dash start location).
 */
export function centerPathAngleFor(
  location: GridLocation,
  centerFallback: GridLocation
): number {
  const pt =
    GRID_POINT[location] ?? GRID_POINT[centerFallback] ?? GRID_POINT[GridLocation.EAST]!;
  // SVG y grows downward; the engine's centerPathAngle is measured in that frame,
  // so atan2(dy, dx) directly (calibrated against poseAt in the calculator test).
  return Math.atan2(pt.y - CENTER, pt.x - CENTER);
}

/**
 * Half-arrow rotation in DEGREES (pipeline arrow-rotation convention): the staff
 * angle at the segment end, from Phase 1's pure orientation→angle bijection.
 * `halfwayOrientation` is the motion's endOrientation (the state at t1).
 */
export function calculateSegmentRotation(
  halfwayOrientation: Orientation,
  location: GridLocation,
  centerFallback: GridLocation
): number {
  const centerPathAngle = centerPathAngleFor(location, centerFallback);
  const staffAngleRad = orientationToStaffAngle(
    halfwayOrientation as Parameters<typeof orientationToStaffAngle>[0],
    centerPathAngle
  );
  const deg = (staffAngleRad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
