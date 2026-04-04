/**
 * Museum Design Rules
 *
 * Constants that govern exhibit placement and room composition.
 * Most spatial rules (corner avoidance, entrance clearance, spacing,
 * wall coverage) are now enforced by construction via wall segment
 * budgets. Only metadata and sightline rules remain here.
 */

import type { Direction } from "./museum-grid-types";

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
