/**
 * Museum Design Rules
 *
 * Constants that govern exhibit placement and room composition.
 * Most spatial rules (corner avoidance, entrance clearance, spacing,
 * wall coverage) are now enforced by construction via wall segment
 * budgets. Only metadata and sightline rules remain here.
 */

import { CAMERA_DEFAULTS } from "@austencloud/camera-3d";

import type { Direction } from "./museum-grid-types";

/**
 * The museum's player physics — the ONE definition of how heavy a visitor is.
 *
 * Every surface that lets someone walk the museum must use these: the museum
 * itself AND every graybox review route. A review route that runs a different
 * gravity is not reviewing the museum; it is reviewing a different game, and
 * every spatial judgement made in it (is that ledge too high? can I get into
 * the water?) is made in the wrong body. That is not hypothetical — the
 * Drowned Gallery review route shipped `gravity={9.81}` against the museum's
 * 24.5, which made the room feel lunar and let the player hop the 1.1 m
 * barrier into the mirror pool (2026-08-09).
 *
 * The normal figure is UnifiedCameraController's own default read from the
 * package rather than restated, so a change there cannot silently make one
 * room heavier than another.
 */
export const MUSEUM_GRAVITY = Math.abs(CAMERA_DEFAULTS.GRAVITY) * 2.5;

/** Jump impulse that pairs with MUSEUM_GRAVITY (UCC's own default). */
export const MUSEUM_JUMP_VELOCITY = CAMERA_DEFAULTS.JUMP_VELOCITY;

/**
 * Apex of a standing jump, in metres above the take-off surface.
 * Any barrier meant to be uncrossable must clear this with margin — see
 * MIN_UNCROSSABLE_BARRIER.
 */
export const MUSEUM_JUMP_APEX =
  (MUSEUM_JUMP_VELOCITY * MUSEUM_JUMP_VELOCITY) / (2 * MUSEUM_GRAVITY);

/**
 * Minimum height for a barrier the player must never cross, measured from the
 * highest floor adjacent to it. Jump apex plus headroom for the character
 * controller's autostep, which will happily mount a barrier the jump only
 * *nearly* clears.
 */
export const MIN_UNCROSSABLE_BARRIER = MUSEUM_JUMP_APEX + 0.6;

/** Whether dev-whiteboard exhibits are enabled (shows designer notes in-game) */
export const DEV_WHITEBOARDS_ENABLED = true;

/**
 * Maps each wall direction to the wall directly across the room.
 * Used by the exhibit placement validator to check sight-line balance:
 * an anchor piece on the north wall should have a complementary piece
 * on the south wall, and vice versa.
 */
export const OPPOSITE_WALL: Record<Direction, Direction> = {
  north: "south",
  south: "north",
  east: "west",
  west: "east",
};
