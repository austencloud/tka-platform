import { GridLocation, type GridMode } from "./enums/grid-enums";
import { Orientation } from "../../shared/domain/enums/pictograph-enums";
import PropRotAngleManager from "../../prop/services/prop-rot-angle-manager";

/**
 * Maps a drag away from a grid point onto the orientation whose rendered prop
 * points that way.
 *
 * The whole idea rests on one fact: PropRotAngleManager's rotation angle IS the
 * direction the prop's tip ends up pointing, in SVG convention (0=east,
 * 90=south, 180=west, 270=north). So "drag toward north from the east point"
 * and "counter at east renders at 270" are the same statement. Press a point,
 * drag where you want the prop aimed, and it aims there.
 *
 * Snap targets are computed FROM the rotation manager rather than restated in a
 * second table here. That is deliberate: a local copy would be free to drift
 * from what the renderer actually draws, and it would need its own box-mode and
 * intercardinal entries. Asking the renderer means box mode and the
 * intercardinal locations work without another line of code.
 */

/** Drag distance, in SVG viewBox units, before a drag counts as aiming. Below
 *  this a press is just a tap and the prop keeps the orientation it had, which
 *  is what preserves the pre-drag tap behavior exactly. */
export const DRAG_AIM_DEAD_ZONE = 60;

/** The four radial/tangential orientations a start position can use. The
 *  interradial set (CLOCK_IN and friends) is Level 6 and deliberately absent —
 *  an 8-way snap is twitchy on touch, and those angles are marked approximate
 *  in the rotation manager. */
const SNAP_ORIENTATIONS: readonly Orientation[] = [
  Orientation.IN,
  Orientation.OUT,
  Orientation.CLOCK,
  Orientation.COUNTER,
];

/** At center there is no radial reference, so aiming uses the absolute
 * compass family instead. Eight directions match the center orientation
 * vocabulary and keep a drag aligned with the direction the prop renders. */
const CENTER_SNAP_ORIENTATIONS: readonly Orientation[] = [
  Orientation.CENTER_N,
  Orientation.CENTER_NE,
  Orientation.CENTER_E,
  Orientation.CENTER_SE,
  Orientation.CENTER_S,
  Orientation.CENTER_SW,
  Orientation.CENTER_W,
  Orientation.CENTER_NW,
];

const CENTER_ORIENTATION_SET = new Set<Orientation>(CENTER_SNAP_ORIENTATIONS);

/**
 * Keep the orientation family valid when a prop moves into or out of center.
 * The next drag can refine the aim, but a plain tap must still produce a valid
 * held pose.
 */
export function normalizeOrientationForLocation(
  orientation: Orientation,
  location: GridLocation
): Orientation {
  if (location === GridLocation.CENTER) {
    return CENTER_ORIENTATION_SET.has(orientation)
      ? orientation
      : Orientation.CENTER_N;
  }

  return CENTER_ORIENTATION_SET.has(orientation) ? Orientation.IN : orientation;
}

function normalizeDegrees(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Shortest distance between two headings, so 350° and 10° read as 20° apart. */
function angularDistance(a: number, b: number): number {
  const raw = Math.abs(normalizeDegrees(a) - normalizeDegrees(b));
  return raw > 180 ? 360 - raw : raw;
}

export interface OrientationFromDragInput {
  /** The grid point being dragged from. */
  location: GridLocation;
  gridMode: GridMode;
  /** Drag vector in SVG user space, measured from the grid point's own
   *  coordinates — not from where the pointer first landed. Measuring from the
   *  point means a sloppy initial press can't skew the resulting angle. */
  dx: number;
  dy: number;
  deadZone?: number;
}

/**
 * Returns the orientation the drag is aiming at, or null when the drag is too
 * short to mean anything (caller should leave the current orientation alone).
 */
export function orientationFromDrag({
  location,
  gridMode,
  dx,
  dy,
  deadZone = DRAG_AIM_DEAD_ZONE,
}: OrientationFromDragInput): Orientation | null {
  if (Math.hypot(dx, dy) < deadZone) return null;

  // SVG y grows downward, which is exactly the convention the rotation manager
  // documents, so no sign flip is needed here.
  const dragAngle = normalizeDegrees((Math.atan2(dy, dx) * 180) / Math.PI);
  const candidates =
    location === GridLocation.CENTER
      ? CENTER_SNAP_ORIENTATIONS
      : SNAP_ORIENTATIONS;

  let best: Orientation | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const orientation of candidates) {
    const renderedAngle = PropRotAngleManager.calculateRotation(
      location,
      orientation,
      gridMode
    );
    const distance = angularDistance(dragAngle, renderedAngle);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = orientation;
    }
  }

  return best;
}

/**
 * The aiming directions available at a location, for drawing the ticks that
 * make the gesture discoverable. Same source as the snap, so a tick can never
 * point somewhere the snap won't land.
 */
export function aimDirectionsFor(
  location: GridLocation,
  gridMode: GridMode
): { orientation: Orientation; angle: number }[] {
  const candidates =
    location === GridLocation.CENTER
      ? CENTER_SNAP_ORIENTATIONS
      : SNAP_ORIENTATIONS;

  return candidates.map((orientation) => ({
    orientation,
    angle: normalizeDegrees(
      PropRotAngleManager.calculateRotation(location, orientation, gridMode)
    ),
  }));
}
