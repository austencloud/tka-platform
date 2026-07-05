import { GridLocation } from "../../../../grid/domain/enums/grid-enums.ts";

/**
 * FLOAT arrow rotation maps.
 *
 * IMPORTANT: Float rotation is based on HANDPATH DIRECTION, not prop rotation direction!
 * Handpath direction is determined by the motion from start location to end location.
 *
 * Clockwise handpath: S→W, W→N, N→E, E→S, NE→SE, SE→SW, SW→NW, NW→NE
 * Counter-clockwise handpath: W→S, N→W, E→N, S→E, NE→NW, NW→SW, SW→SE, SE→NE
 */

/**
 * Grid location positions in screen coordinates (x-right, y-down).
 * Used to compute geometric angles for skewed/cross-grid float arrows.
 */
const GRID_SCREEN_COORDS: Record<GridLocation, { x: number; y: number }> = {
  [GridLocation.NORTH]: { x: 0, y: -1 },
  [GridLocation.NORTHEAST]: { x: 1, y: -1 },
  [GridLocation.EAST]: { x: 1, y: 0 },
  [GridLocation.SOUTHEAST]: { x: 1, y: 1 },
  [GridLocation.SOUTH]: { x: 0, y: 1 },
  [GridLocation.SOUTHWEST]: { x: -1, y: 1 },
  [GridLocation.WEST]: { x: -1, y: 0 },
  [GridLocation.NORTHWEST]: { x: -1, y: -1 },
  [GridLocation.CENTER]: { x: 0, y: 0 },
};

/**
 * Compute the geometric float arrow rotation for a skewed/cross-grid shift.
 *
 * For non-adjacent, non-opposite start/end pairs (e.g. N→SE, W→NE, S→NE),
 * the standard CW/CCW handpath maps don't cover the pair. This function
 * computes the angle from start position to end position in screen coordinates,
 * matching the float arrow SVG's base orientation (0° = pointing East).
 *
 * @returns Rotation angle in degrees (0-360), or null if positions are identical
 *          or a position isn't recognized.
 */
export function calculateSkewedFloatRotation(
  startLocation: GridLocation,
  endLocation: GridLocation
): number | null {
  const startCoord = GRID_SCREEN_COORDS[startLocation];
  const endCoord = GRID_SCREEN_COORDS[endLocation];

  if (!startCoord || !endCoord) return null;

  const dx = endCoord.x - startCoord.x;
  const dy = endCoord.y - startCoord.y;

  if (dx === 0 && dy === 0) return null;

  // atan2(dy, dx) gives angle in radians with 0° = East, increasing CW in screen coords
  const radians = Math.atan2(dy, dx);
  const degrees = (radians * 180) / Math.PI;

  // Normalize to 0-360
  return ((degrees % 360) + 360) % 360;
}

export const floatClockwiseHandpathMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 315,
  [GridLocation.EAST]: 45,
  [GridLocation.SOUTH]: 135,
  [GridLocation.WEST]: 225,
  [GridLocation.NORTHEAST]: 0,
  [GridLocation.SOUTHEAST]: 90,
  [GridLocation.SOUTHWEST]: 180,
  [GridLocation.NORTHWEST]: 270,
  [GridLocation.CENTER]: 0,
};

// Mirrors proCounterClockwiseMap exactly. A float arrow is the same curved
// shift glyph as PRO (same SVG base orientation, same CCW mirroring in
// shouldMirrorArrow), so its per-quadrant rotations must match PRO's. The CW
// map above already equals proClockwiseMap; this one previously sat 90° off
// across the board, so every CCW-handpath float arrow rendered visibly
// rotated (caught on the Level 1 guide's Split-Opp/Tog-Opp rows).
export const floatCounterClockwiseHandpathMap: Record<GridLocation, number> = {
  [GridLocation.NORTH]: 45,
  [GridLocation.EAST]: 135,
  [GridLocation.SOUTH]: 225,
  [GridLocation.WEST]: 315,
  [GridLocation.NORTHEAST]: 90,
  [GridLocation.SOUTHEAST]: 180,
  [GridLocation.SOUTHWEST]: 270,
  [GridLocation.NORTHWEST]: 0,
  [GridLocation.CENTER]: 0,
};
