/**
 * The performer pedestal — the museum's one constant across all 19 exhibit
 * cases in all six wings.
 *
 * The wings must not look alike; six elemental treatments is the point. So
 * cohesion cannot come from material, colour or light. It comes from one piece
 * of repeated grammar: the same object under every performer, doing the same
 * job, dressed differently each time.
 *
 * Fixed here, everywhere: the footprint, the edge profile, the eye-line rule
 * below, and the fact that the top face carries the GENERATED figure of the
 * sequence performed above it. Free per wing: material, colour, light
 * temperature, and what the pedestal stands in or on.
 *
 * HEIGHT IS NOT ONE OF THE FIXED THINGS, and the first draft of the spec had
 * that wrong. A single number cannot be right in two wings at once: Water
 * stands its performers on a shelf 0.7 m BELOW the visitor's walking line, so
 * the height that reads well on a level floor puts the drawing at the visitor's
 * knees there. What is actually constant — and it is a better constant than a
 * number, because it is the same EXPERIENCE rather than the same measurement —
 * is the rule that every pedestal in the museum puts the prop circle on the
 * visitor's eye line. On a level floor that makes the pedestal a low disc. In a
 * sunken alcove it makes the same object a tall stanchion. The visitor never
 * notices the difference, which is the point.
 *
 * Spec: docs/superpowers/specs/2026-08-16-museum-pedestal-and-console-design.md
 */

/**
 * Reference body height, used only where nothing constrains the eye line (an
 * empty display pedestal with no performer on it, for instance).
 *
 * Matches the Water opener plinth's existing 1.05 m so the two read as one
 * family rather than as a plinth and a pedestal that happen to share a room.
 */
export const PEDESTAL_NOMINAL_H = 1.05;

/**
 * The shortest a pedestal is allowed to be.
 *
 * The eye-line rule can derive a top that sits at or below the floor the
 * pedestal stands on — which happens whenever the performer's own floor is
 * already high enough. The object still has to read as a pedestal, so it never
 * goes below a visible lift.
 */
export const PEDESTAL_MIN_H = 0.18;

/** Footprint across, in metres. A performer needs the full hand circle on it. */
export const PEDESTAL_DIAMETER = 1.6;

/** The lip that catches light and reads the edge at a distance. */
export const PEDESTAL_EDGE = 0.06;

/**
 * The face is sunk below the lip.
 *
 * A visitor standing on the floor reads the top face at a shallow angle. Sunk
 * behind a lip, the figure is lit from inside a shadowed well instead of
 * catching the room's glare across a flat plate, which is what makes it legible
 * from the walking line rather than only from directly above.
 */
export const PEDESTAL_FACE_INSET = 0.04;

/**
 * Where a performer's prop circle sits above their own feet.
 *
 * Hands ride at roughly shoulder height on a standing figure, and the circle
 * the props sweep is centred there. This is the number that decides how high
 * the pedestal's top must be for the drawing to land in front of the visitor's
 * face rather than over their head.
 */
export const PERFORMER_PROP_CENTRE_ABOVE_FEET = 1.35;

/**
 * The top elevation that puts the prop circle on the visitor's eye line.
 *
 * Derived, never guessed — the same discipline as the water fences, which are
 * computed from the jump arc rather than hand-picked. A fixed pedestal
 * elevation cannot be right in two wings at once: Water stands its performers
 * on a shelf 0.7 m BELOW the walking line, so a number that works on a level
 * floor puts the drawing at the visitor's knees there.
 *
 * @param visitorFloorY the datum the VISITOR walks on, not the performer's
 * @param eyeAboveFloor the visitor's eye height above that datum
 */
export function pedestalTopYForEyeLine(
  visitorFloorY: number,
  eyeAboveFloor: number
): number {
  return visitorFloorY + eyeAboveFloor - PERFORMER_PROP_CENTRE_ABOVE_FEET;
}

export interface PedestalSizing {
  /** Elevation of the top face — where the performer's feet land. */
  topY: number;
  /** Elevation of the base. Below the standing surface when the body is sunk. */
  baseY: number;
  /** Visible body height, floored at PEDESTAL_MIN_H. */
  height: number;
  /**
   * True when the eye-line rule wanted a top at or below the surface the
   * pedestal stands on, so the floor took over. The drawing then sits slightly
   * above the visitor's eye line, which is the safe direction to miss in — a
   * figure a little high still reads; one below the walking line does not.
   */
  flooredToMinimum: boolean;
}

/**
 * Size one pedestal from the two floors it sits between.
 *
 * @param standingSurfaceY what the pedestal itself stands on (shelf, apron, pool bottom)
 * @param visitorFloorY the datum the VISITOR walks on
 * @param eyeAboveFloor the visitor's eye height above that datum
 */
export function sizePedestal(
  standingSurfaceY: number,
  visitorFloorY: number,
  eyeAboveFloor: number
): PedestalSizing {
  const wantedTop = pedestalTopYForEyeLine(visitorFloorY, eyeAboveFloor);
  const wantedHeight = wantedTop - standingSurfaceY;
  const flooredToMinimum = wantedHeight < PEDESTAL_MIN_H;
  const height = flooredToMinimum ? PEDESTAL_MIN_H : wantedHeight;
  return {
    topY: standingSurfaceY + height,
    baseY: standingSurfaceY,
    height,
    flooredToMinimum,
  };
}

/**
 * Which figures the face draws for a given prop.
 *
 * A BILATERAL prop is held at its centre and extends equally both ways — a
 * staff — so both of its ends draw, and the face carries two figures at once.
 * A UNILATERAL prop is held at one end — a fan — so one end draws, and the face
 * carries one. (MCP glossary: `get_term_definition("bilateral")`.)
 *
 * This is the lesson the prop control delivers, and it is two lessons rather
 * than one: the figure belongs to the hand, the copy count belongs to the prop.
 */
const BILATERAL_PROPS = new Set([
  "staff",
  "simplestaff",
  "bigstaff",
  "doublestar",
  "quiad",
  "sword",
  "guitar",
  "ukulele",
]);

export function propIsBilateral(propType: string): boolean {
  return BILATERAL_PROPS.has(propType.toLowerCase());
}

/** How many copies of the figure a prop draws. Two for bilateral, one for not. */
export function faceTraceCount(propType: string): 1 | 2 {
  return propIsBilateral(propType) ? 2 : 1;
}
