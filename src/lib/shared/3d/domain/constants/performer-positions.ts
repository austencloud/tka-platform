/**
 * Performer Position Calculator
 *
 * Default spawn positions for 1-8 performers arranged into rows of two.
 * Odd counts put a lone performer centered at the rear of their row.
 * All performers face the same direction (toward camera).
 */

import { STAGE } from "$lib/shared/3d/scale/scale-constants";

export interface PerformerPosition {
  x: number;
  z: number;
}

// All values in meters (1 unit = 1 meter)
// Uses centralized STAGE constants for consistency
const GRID_SPACING = STAGE.PERFORMER_SPACING;

// Offset to position avatar behind the wall plane (facing it)
// ~30cm behind the grid plane (negative because avatar is BEHIND the grid)
export const WALL_OFFSET = -STAGE.AVATAR_GRID_OFFSET;

/**
 * Default grid positions for counts 1-8. Shape evolves row-by-row:
 *
 *   count 1 → [0]
 *   count 2 → [0] [1]
 *   count 3 → [0] [1]        count 4 → [0] [1]
 *                 [2]                      [2] [3]
 *   count 5 → [0] [1]        count 6 → [0] [1]
 *                 [2] [3]                   [2] [3]
 *                     [4]                   [4] [5]
 *   count 7 → [0] [1]        count 8 → [0] [1]
 *                 [2] [3]                   [2] [3]
 *                 [4] [5]                   [4] [5]
 *                     [6]                   [6] [7]
 *
 * Row n lives at z = -n * GRID_SPACING + WALL_OFFSET. Paired performers
 * sit at ±GRID_SPACING/2; a lone last-row performer sits at x=0 (centered).
 * Counts beyond 8 are clamped - the viewer's MAX_VIEWER_PERFORMERS cap
 * already enforces this at the manager level, but the function stays safe
 * for any caller.
 */
export function getDefaultPositions(count: number): PerformerPosition[] {
  if (count <= 0) return [];
  if (count > 8) count = 8;

  if (count === 1) {
    return [{ x: 0, z: WALL_OFFSET }];
  }

  const positions: PerformerPosition[] = [];
  const lastRow = Math.floor((count - 1) / 2);
  const lastRowIsSingleton = count % 2 === 1;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const rowZ = -row * GRID_SPACING + WALL_OFFSET;

    // A lone performer in the final row gets centered; otherwise the pair
    // sits at ±GRID_SPACING/2.
    if (row === lastRow && lastRowIsSingleton) {
      positions.push({ x: 0, z: rowZ });
    } else {
      positions.push({
        x: (col === 0 ? -1 : 1) * (GRID_SPACING / 2),
        z: rowZ,
      });
    }
  }

  return positions;
}

/**
 * Get position for a specific performer index
 */
export function getPerformerPosition(
  index: number,
  totalCount: number
): PerformerPosition {
  const positions = getDefaultPositions(totalCount);
  return positions[index] ?? { x: 0, z: 0 };
}

/**
 * Grid spacing constant for external use
 */
export const PERFORMER_GRID_SPACING = STAGE.PERFORMER_SPACING;

/**
 * Maximum supported performers
 */
export const MAX_PERFORMERS = STAGE.MAX_PERFORMERS;
