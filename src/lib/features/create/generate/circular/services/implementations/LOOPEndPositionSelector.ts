import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";

import {
  SWAPPED_POSITION_MAP,
  VERTICAL_MIRROR_POSITION_MAP,
  HORIZONTAL_MIRROR_POSITION_MAP,
} from "../../domain/constants/strict-loop-position-maps";
import type { Period } from "../../domain/models/circular-models";
import { LOOPType } from "../../domain/models/circular-models";
import { determineRotatedEndPosition } from "../rotated-end-position-selector";

/**
 * Service for determining required end positions for different LOOP types
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
export class LOOPEndPositionSelector {

  /**
   * Determine the required end position based on LOOP type
   */
  determineEndPosition(
    loopType: LOOPType,
    startPosition: GridPosition,
    period: Period
  ): GridPosition | null {
    switch (loopType) {
      // Strict LOOP types
      case LOOPType.ROTATED:
        // Rotated LOOP uses rotation maps (halved or quartered)
        return determineRotatedEndPosition(
          period,
          startPosition
        );

      case LOOPType.MIRRORED: {
        // Mirrored LOOP uses vertical mirror map
        // Non-null assertion: LOOP operations only use alpha/beta/gamma positions
        const mirroredEnd = VERTICAL_MIRROR_POSITION_MAP[startPosition]!;
        return mirroredEnd;
      }

      case LOOPType.FLIPPED: {
        // Flipped LOOP uses horizontal mirror map (N ↔ S)
        const flippedEnd = HORIZONTAL_MIRROR_POSITION_MAP[startPosition]!;
        return flippedEnd;
      }

      case LOOPType.SWAPPED: {
        // Swapped LOOP uses swap position map
        // Non-null assertion: LOOP operations only use alpha/beta/gamma positions
        const swappedEnd = SWAPPED_POSITION_MAP[startPosition]!;
        return swappedEnd;
      }

      case LOOPType.INVERTED:
        // Inverted LOOP returns to start position (same position)
        return startPosition;

      // Combined LOOP types with ROTATED (rotation takes precedence)
      case LOOPType.ROTATED_INVERTED:
      case LOOPType.ROTATED_SWAPPED:
        // Any rotation-based LOOP uses rotation maps
        return determineRotatedEndPosition(
          period,
          startPosition
        );

      // MIRRORED_ROTATED: Two-step composition
      // First applies rotation (halved or quartered), then mirroring
      // End position must satisfy the rotation requirement for the chosen slice size
      case LOOPType.MIRRORED_ROTATED:
        // Use the user-selected slice size for rotation (rotation returns to home)
        return determineRotatedEndPosition(
          period,
          startPosition
        );

      // MIRRORED_INVERTED_ROTATED: Three-step composition
      // First applies rotation (halved or quartered), then inverted mirroring
      // End position must satisfy the rotation requirement for the chosen slice size
      case LOOPType.MIRRORED_INVERTED_ROTATED:
        // Use the user-selected slice size for rotation (rotation returns to home)
        return determineRotatedEndPosition(
          period,
          startPosition
        );

      // MIRRORED_ROTATED_INVERTED_SWAPPED: Four-step composition
      // First applies rotation (halved or quartered), then mirrored+swapped+inverted
      // End position must satisfy the rotation requirement for the chosen slice size
      case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
        // Use the user-selected slice size for rotation (rotation returns to home)
        return determineRotatedEndPosition(
          period,
          startPosition
        );

      // Combined LOOP types with MIRRORED
      case LOOPType.MIRRORED_INVERTED:
        // Mirrored-inverted uses just vertical mirror map
        // Non-null assertion: LOOP operations only use alpha/beta/gamma positions
        return VERTICAL_MIRROR_POSITION_MAP[startPosition]!;

      case LOOPType.MIRRORED_SWAPPED: {
        // Mirrored-swapped requires BOTH transformations:
        // 1. First mirror the position (east<->west)
        // 2. Then swap the colors (blue<->red positions)
        // This ensures the end position has swapped prop locations
        // Non-null assertion: LOOP operations only use alpha/beta/gamma positions
        const mirroredPosition = VERTICAL_MIRROR_POSITION_MAP[startPosition]!;
        return SWAPPED_POSITION_MAP[mirroredPosition]!;
      }

      // Combined LOOP types with SWAPPED + INVERTED
      case LOOPType.SWAPPED_INVERTED:
        // Inverted takes precedence - return to start position
        return startPosition;

      case LOOPType.STRICT_REWOUND:
        // Rewound has no position constraint - reversed steps return to start naturally
        return null;

      default:
        throw new Error(
          `LOOP type "${loopType}" is not yet implemented. ` +
            `Currently supported: ROTATED, MIRRORED, FLIPPED, SWAPPED, ` +
            `INVERTED, MIRRORED_INVERTED, MIRRORED_SWAPPED, ` +
            `ROTATED_INVERTED, ROTATED_SWAPPED, SWAPPED_INVERTED, MIRRORED_ROTATED, ` +
            `MIRRORED_INVERTED_ROTATED, MIRRORED_ROTATED_INVERTED_SWAPPED`
        );
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const loopEndPositionSelector = new LOOPEndPositionSelector();
