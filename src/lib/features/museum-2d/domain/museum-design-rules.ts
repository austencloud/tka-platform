/**
 * Museum Design Rules
 *
 * Constants that govern exhibit placement, spacing, and room composition.
 * These rules are consumed by the layout engine and future validation
 * passes to ensure rooms feel intentionally curated, not randomly packed.
 */

import type { Direction } from "./museum-grid-types";

/** How many tiles to keep clear of room corners when placing exhibits */
export const CORNER_AVOIDANCE = 1;

/** How many tiles to keep clear around doorway openings */
export const ENTRANCE_CLEARANCE = 2;

/** Minimum tile gap between adjacent exhibits (relaxed within a group) */
export const EXHIBIT_SPACING = 2;

/** Maximum fraction of a wall's length that can be covered by exhibits */
export const MAX_WALL_COVERAGE = 0.7;

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
