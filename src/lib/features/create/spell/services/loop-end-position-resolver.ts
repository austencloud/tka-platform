/**
 * LOOP End Position Resolver
 *
 * Determines valid end positions for a sequence seed given a start position and LOOP type.
 * Composes from existing position maps (rotation, mirror, swap) rather than introducing
 * new data. Follows the same precedence as LOOPEndPositionSelector:
 *
 *   ROTATED > MIRRORED > INVERTED > SWAPPED
 *
 * For composite LOOPs, only the highest-precedence transformation constrains the
 * seed's end position. Outer transformations operate on the already-extended result.
 */

import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  LOOPType,
  Period,
} from "$lib/shared/foundation/domain/models/generation/circular-models";

/**
 * Interface describing the shape of the LOOP end position resolver module.
 * Consumers that previously held a class instance can use this type.
 */
export interface LOOPEndPositionResolver {
  getValidEndPositions: (startPosition: GridPosition, loopType: LOOPType, period?: Period) => GridPosition[];
  isValidEndPosition: (startPosition: GridPosition, endPosition: GridPosition, loopType: LOOPType, period?: Period) => boolean;
}
import {
  HALF_POSITION_MAP,
  QUARTER_POSITION_MAP_CW,
  QUARTER_POSITION_MAP_CCW,
} from "$lib/shared/foundation/domain/models/generation/circular-position-maps";
import {
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
  SWAPPED_POSITION_MAP,
} from "$lib/features/create/generate/circular/domain/constants/strict-loop-position-maps";

export function getValidEndPositions(
  startPosition: GridPosition,
  loopType: LOOPType,
  period: Period = Period.HALVED
): GridPosition[] {
  switch (loopType) {
    // --- REWOUND: No position constraint ---
    case LOOPType.STRICT_REWOUND:
      return [];

    // --- ROTATED (and composites where rotation takes precedence) ---
    case LOOPType.ROTATED:
    case LOOPType.ROTATED_INVERTED:
    case LOOPType.ROTATED_SWAPPED:
    case LOOPType.ROTATED_SWAPPED_INVERTED:
    case LOOPType.MIRRORED_ROTATED:
    case LOOPType.MIRRORED_INVERTED_ROTATED:
    case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
      return getRotatedEndPositions(startPosition, period);

    // --- MIRRORED (vertical mirror, and composites without rotation) ---
    case LOOPType.MIRRORED:
    case LOOPType.MIRRORED_INVERTED:
      return getSingleEndPosition(VERTICAL_MIRROR_POSITION_MAP, startPosition);

    // --- FLIPPED (horizontal mirror) ---
    case LOOPType.FLIPPED:
      return getSingleEndPosition(HORIZONTAL_MIRROR_POSITION_MAP, startPosition);

    // --- MIRRORED_SWAPPED: compose mirror then swap ---
    case LOOPType.MIRRORED_SWAPPED: {
      const mirrored = VERTICAL_MIRROR_POSITION_MAP[startPosition];
      if (!mirrored) return [];
      const swapped = SWAPPED_POSITION_MAP[mirrored];
      return swapped ? [swapped] : [];
    }

    // --- SWAPPED (strict only, no rotation/mirror) ---
    case LOOPType.SWAPPED:
    case LOOPType.SWAPPED_INVERTED:
      return getSingleEndPosition(SWAPPED_POSITION_MAP, startPosition);

    // --- INVERTED alone: must return to start ---
    case LOOPType.INVERTED:
      return [startPosition];

    default:
      // Unknown LOOP type - return empty (unconstrained) so generation still works
      console.warn(
        `[LOOPEndPositionResolver] Unknown LOOP type: ${loopType}. Skipping end position constraint.`
      );
      return [];
  }
}

export function isValidEndPosition(
  startPosition: GridPosition,
  endPosition: GridPosition,
  loopType: LOOPType,
  period: Period = Period.HALVED
): boolean {
  const validPositions = getValidEndPositions(startPosition, loopType, period);

  // Empty array means unconstrained - any position is valid
  if (validPositions.length === 0) return true;

  return validPositions.includes(endPosition);
}

// ============================================================================
// PRIVATE HELPERS
// ============================================================================

/**
 * Get valid end positions for rotation-based LOOPs.
 * For halved: returns the single 180-rotated position.
 * For quartered: returns both CW and CCW 90 targets for maximum flexibility.
 */
function getRotatedEndPositions(
  startPosition: GridPosition,
  period: Period
): GridPosition[] {
  if (period === Period.QUARTERED) {
    const positions: GridPosition[] = [];
    const cw = QUARTER_POSITION_MAP_CW[startPosition];
    const ccw = QUARTER_POSITION_MAP_CCW[startPosition];
    if (cw) positions.push(cw);
    if (ccw && ccw !== cw) positions.push(ccw);
    return positions;
  }

  // HALVED - single 180 position
  const halved = HALF_POSITION_MAP[startPosition];
  return halved ? [halved] : [];
}

/**
 * Look up a single end position from a Record<GridPosition, GridPosition> map.
 */
function getSingleEndPosition(
  map: Record<GridPosition, GridPosition>,
  startPosition: GridPosition
): GridPosition[] {
  const result = map[startPosition];
  return result ? [result] : [];
}
