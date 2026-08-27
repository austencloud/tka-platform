/**
 * Position Analyzer Implementation
 *
 * Handles analysis of position data for end position calculations, grouping,
 * and rotation relationships. Used by option picker and sequence extension.
 */

import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import { GridPositionGroup } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { GridPosition } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { RotationRelation } from "./types";
import { getGridPositionFromLocations } from "$lib/shared/pictograph/grid/services/grid-position-deriver";

export class PositionAnalyzer {

  /**
   * Get the position group (Alpha, Beta, Gamma) from a GridPosition
   */
  getEndPositionGroup(
    endPosition: GridPosition | null | undefined
  ): GridPositionGroup | null {
    if (!endPosition) return null;

    const positionStr = endPosition.toString().toLowerCase();

    if (positionStr.startsWith("alpha")) return GridPositionGroup.ALPHA;
    if (positionStr.startsWith("beta")) return GridPositionGroup.BETA;
    if (positionStr.startsWith("gamma")) return GridPositionGroup.GAMMA;

    return null;
  }

  /**
   * Calculate end position from motion data
   */
  getEndPosition(pictographData: PictographData): string | null {
    if (!pictographData.motions.blue || !pictographData.motions.red) {
      return null;
    }

    try {
      const endPosition = getGridPositionFromLocations(
        pictographData.motions.blue.endLocation,
        pictographData.motions.red.endLocation
      );

      return endPosition.toString();
    } catch (error) {
      console.error("Error calculating end position:", error);
      return null;
    }
  }

  /**
   * Extract the numeric part of a position (e.g., "alpha3" → 3)
   */
  getPositionNumber(position: GridPosition): number | null {
    const match = position.toString().match(/(\d+)$/);
    return match?.[1] ? parseInt(match[1], 10) : null;
  }

  /**
   * Calculate the rotation relationship between two positions in the same group.
   */
  getRotationRelation(
    startPosition: GridPosition,
    endPosition: GridPosition
  ): RotationRelation | null {
    const startGroup = this.getEndPositionGroup(startPosition);
    const endGroup = this.getEndPositionGroup(endPosition);

    // Must be in same group
    if (!startGroup || !endGroup || startGroup !== endGroup) {
      return null;
    }

    const startNum = this.getPositionNumber(startPosition);
    const endNum = this.getPositionNumber(endPosition);

    if (startNum === null || endNum === null) {
      return null;
    }

    // Same position = exact
    if (startNum === endNum) {
      return "exact";
    }

    // Calculate the difference (accounting for circular wraparound)
    const isGamma = startGroup === GridPositionGroup.GAMMA;
    const totalPositions = isGamma ? 16 : 8;
    const quarterStep = isGamma ? 4 : 2;
    const halfStep = isGamma ? 8 : 4;

    // Calculate absolute difference, accounting for wraparound
    let diff = Math.abs(endNum - startNum);
    if (diff > totalPositions / 2) {
      diff = totalPositions - diff;
    }

    if (diff === halfStep) {
      return "half";
    }
    if (diff === quarterStep || diff === quarterStep * 3) {
      return "quarter";
    }

    // Default to quarter for other valid position relationships
    return "quarter";
  }

  /**
   * Check if two positions are in the same group (can potentially form a loop)
   */
  areInSameGroup(position1: GridPosition, position2: GridPosition): boolean {
    const group1 = this.getEndPositionGroup(position1);
    const group2 = this.getEndPositionGroup(position2);
    return group1 !== null && group1 === group2;
  }
}

export const positionAnalyzer = new PositionAnalyzer();
