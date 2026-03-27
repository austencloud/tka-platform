/**
 * Performer Position Calculator
 *
 * Calculates default positions for 1-4 performers in a 2x2 grid arrangement.
 * All performers face the same direction (toward camera).
 */

import { STAGE } from "$lib/shared/3d-animation/scale/scale-constants";

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
 * Default 2x2 grid positions (all facing same direction)
 *
 *   [1] [2]     Front row (z = 0)
 *   [3] [4]     Back row (z = -GRID_SPACING)
 *
 * For 1 performer: centered at origin
 * For 2 performers: side by side in front row
 * For 3 performers: 2 front, 1 back-center
 * For 4 performers: full 2x2 grid
 */
export function getDefaultPositions(count: number): PerformerPosition[] {
  if (count <= 0) return [];
  if (count > 4) count = 4;

  // Single performer: centered, offset back from wall plane
  if (count === 1) {
    return [{ x: 0, z: WALL_OFFSET }];
  }

  // Two performers: side by side
  if (count === 2) {
    return [
      { x: -GRID_SPACING / 2, z: WALL_OFFSET }, // Left
      { x: GRID_SPACING / 2, z: WALL_OFFSET }, // Right
    ];
  }

  // Three performers: 2 front, 1 back center
  if (count === 3) {
    return [
      { x: -GRID_SPACING / 2, z: WALL_OFFSET }, // Front-left
      { x: GRID_SPACING / 2, z: WALL_OFFSET }, // Front-right
      { x: 0, z: -GRID_SPACING + WALL_OFFSET }, // Back-center
    ];
  }

  // Four performers: full 2x2 grid
  return [
    { x: -GRID_SPACING / 2, z: WALL_OFFSET }, // Front-left
    { x: GRID_SPACING / 2, z: WALL_OFFSET }, // Front-right
    { x: -GRID_SPACING / 2, z: -GRID_SPACING + WALL_OFFSET }, // Back-left
    { x: GRID_SPACING / 2, z: -GRID_SPACING + WALL_OFFSET }, // Back-right
  ];
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
