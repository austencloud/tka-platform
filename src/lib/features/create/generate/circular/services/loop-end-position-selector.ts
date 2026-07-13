import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

import {
  SWAPPED_POSITION_MAP,
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
} from "../domain/constants/strict-loop-position-maps";
import type { Period } from "../domain/models/circular-models";
import { LOOPType } from "../domain/models/circular-models";
import { determineRotatedEndPosition } from "./rotated-end-position-selector";

/**
 * Determine the required end position based on LOOP type
 *
 * Routes to the appropriate position calculation based on LOOP type:
 * - Rotated (with or without Inverted/Swapped): Uses rotation maps (depends on slice size)
 * - Mirrored (with or without Inverted/Swapped): Uses vertical mirror map
 * - Swapped + Inverted (no Rotated/Mirrored): Returns to start position
 * - Inverted alone: Returns to start position (no transformation)
 * - Swapped alone: Uses swap position map
 *
 * Precedence order when combined:
 * 1. ROTATED (rotation takes precedence)
 * 2. MIRRORED (mirror takes precedence over inverted/swapped)
 * 3. INVERTED (return to start takes precedence over swapped)
 * 4. SWAPPED (only for strict swapped)
 */
export function determineEndPosition(
  loopType: LOOPType,
  startPosition: GridPosition,
  period: Period
): GridPosition | null {
  switch (loopType) {
    case LOOPType.ROTATED:
      return determineRotatedEndPosition(period, startPosition);

    case LOOPType.MIRRORED: {
      const mirroredEnd = VERTICAL_MIRROR_POSITION_MAP[startPosition]!;
      return mirroredEnd;
    }

    case LOOPType.FLIPPED: {
      const flippedEnd = HORIZONTAL_MIRROR_POSITION_MAP[startPosition]!;
      return flippedEnd;
    }

    case LOOPType.SWAPPED: {
      const swappedEnd = SWAPPED_POSITION_MAP[startPosition]!;
      return swappedEnd;
    }

    case LOOPType.INVERTED:
      return startPosition;

    case LOOPType.ROTATED_INVERTED:
    case LOOPType.ROTATED_SWAPPED:
    case LOOPType.ROTATED_SWAPPED_INVERTED:
      return determineRotatedEndPosition(period, startPosition);

    case LOOPType.MIRRORED_ROTATED:
      return determineRotatedEndPosition(period, startPosition);

    case LOOPType.MIRRORED_INVERTED_ROTATED:
      return determineRotatedEndPosition(period, startPosition);

    case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
      return determineRotatedEndPosition(period, startPosition);

    case LOOPType.MIRRORED_INVERTED:
      return VERTICAL_MIRROR_POSITION_MAP[startPosition]!;

    case LOOPType.MIRRORED_SWAPPED: {
      const mirroredPosition = VERTICAL_MIRROR_POSITION_MAP[startPosition]!;
      return SWAPPED_POSITION_MAP[mirroredPosition]!;
    }

    case LOOPType.SWAPPED_INVERTED:
      return startPosition;

    case LOOPType.STRICT_REWOUND:
      return null;

    default:
      throw new Error(
        `LOOP type "${loopType}" is not yet implemented. ` +
          `Currently supported: ROTATED, MIRRORED, FLIPPED, SWAPPED, ` +
          `INVERTED, MIRRORED_INVERTED, MIRRORED_SWAPPED, ` +
          `ROTATED_INVERTED, ROTATED_SWAPPED, ROTATED_SWAPPED_INVERTED, SWAPPED_INVERTED, MIRRORED_ROTATED, ` +
          `MIRRORED_INVERTED_ROTATED, MIRRORED_ROTATED_INVERTED_SWAPPED`
      );
  }
}
