import { GridLocation } from "../../../../grid/domain/enums/grid-enums";
import type { Orientation } from "../../../../shared/domain/enums/pictograph-enums";
import {
  orientationToStaffAngle,
  RADIAL_CYCLE,
} from "$lib/shared/render/core/calculations/orientation-angle";
import { LOCATION_ANGLES } from "$lib/shared/foundation/domain/math-constants";

/**
 * The center-path angle (RADIANS) for a hand at `location`, i.e. the direction
 * from grid center to the hand, in the engine's convention. Sourced from the
 * canonical `LOCATION_ANGLES` — the same constant the production engine uses to
 * produce `centerPathAngle` — so this never re-derives grid geometry.
 *
 * For a CENTER location (dash midpoint) there is no outward direction; fall back
 * to the supplied cardinal reference (the pre-dash start location). Note that
 * `LOCATION_ANGLES` DOES carry a CENTER entry (0, "no angle"), so a bare
 * `LOCATION_ANGLES[location]` would return 0 for a center location instead of
 * falling back — CENTER is guarded explicitly to preserve that fallback semantics.
 */
export function centerPathAngleFor(
  location: GridLocation,
  centerFallback: GridLocation
): number {
  const ref = location === GridLocation.CENTER ? centerFallback : location;
  return (
    LOCATION_ANGLES[ref] ??
    LOCATION_ANGLES[centerFallback] ??
    LOCATION_ANGLES[GridLocation.EAST]
  );
}

/**
 * Half-arrow rotation in DEGREES (pipeline arrow-rotation convention): the staff
 * angle at the segment end, from Phase 1's pure orientation→angle bijection.
 * `halfwayOrientation` is the motion's endOrientation (the state at t1).
 *
 * `LOCATION_ANGLES` (via centerPathAngleFor) is already in radians, which is what
 * `orientationToStaffAngle` expects — no unit conversion on the way in.
 */
export function calculateSegmentRotation(
  halfwayOrientation: Orientation,
  location: GridLocation,
  centerFallback: GridLocation
): number {
  // orientationToStaffAngle's contract is "radial: caller guards" — a center-family
  // (centerN…) orientation would silently degrade. Phase 1's calculateOrientationAt
  // returns null for center-family, so nothing in scope reaches this today; warn (do
  // not throw) so a future Phase 3 wiring can't silently ship a wrong number.
  if (!RADIAL_CYCLE.includes(halfwayOrientation as (typeof RADIAL_CYCLE)[number])) {
    console.warn(
      `[segment-rotation] non-radial halfwayOrientation "${halfwayOrientation}" — ` +
        `orientationToStaffAngle guards for radial orientations only; rotation may be wrong.`
    );
  }

  const centerPathAngle = centerPathAngleFor(location, centerFallback);
  const staffAngleRad = orientationToStaffAngle(
    halfwayOrientation as Parameters<typeof orientationToStaffAngle>[0],
    centerPathAngle
  );
  const deg = (staffAngleRad * 180) / Math.PI;
  return ((deg % 360) + 360) % 360;
}
