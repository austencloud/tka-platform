/**
 * Beta Detector Implementation
 *
 * Provides methods for detecting beta positions in pictographs.
 * Migrated from utils/betaDetection.ts to proper service architecture.
 */

import { getGridPositionFromLocations } from "../../grid/services/grid-position-deriver";
import type { GridPosition } from "../../grid/domain/enums/grid-enums";
import type { PictographData } from "../../shared/domain/models/PictographData";

export class BetaDetector {

  /**
   * Check if a grid position is a beta position
   * Beta positions are the BETA enum values
   */
  isBetaPosition(position: GridPosition): boolean {
    return position.toString().startsWith("beta");
  }

  /**
   * Check if a pictograph starts with beta (start position is a beta position)
   */
  startsWithBeta(pictographData: PictographData): boolean {
    if (!pictographData.motions.blue || !pictographData.motions.red) {
      return false;
    }

    const startPosition = getGridPositionFromLocations(
      pictographData.motions.blue.startLocation,
      pictographData.motions.red.startLocation
    );

    return this.isBetaPosition(startPosition);
  }

  /**
   * Check if a pictograph ends with beta (end position is a beta position)
   */
  endsWithBeta(pictographData: PictographData): boolean {
    if (!pictographData.motions.blue || !pictographData.motions.red) {
      // No motion data = can't end with beta position
      // This is expected in some contexts (static pictographs, loading states)
      return false;
    }

    const redEndLocation = pictographData.motions.red.endLocation;
    const blueEndLocation = pictographData.motions.blue.endLocation;

    // Beta detection: both props end at the same location
    return redEndLocation === blueEndLocation;
  }
}

// ============================================================================
// DIRECT EXPORT - Use this instead of betaDetector
// This avoids DI container rebuilds when this file changes
// ============================================================================
export const betaDetector = new BetaDetector();
