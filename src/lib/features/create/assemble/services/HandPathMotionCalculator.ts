/**
 * Hand Path Motion Calculator
 *
 * Calculates motion types and properties based on grid position movements.
 * Used for tap-based hand path construction where users select positions
 * and the system determines the motion type (STATIC, DASH, or SHIFT).
 */

import {
  GridLocation,
  GridMode,
} from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import {
  HandMotionType,
  RotationDirection,
} from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";

export class HandPathMotionCalculator {
  // Clockwise ordering for diamond mode
  private readonly diamondClockwise = [
    GridLocation.NORTH,
    GridLocation.EAST,
    GridLocation.SOUTH,
    GridLocation.WEST,
  ];

  // Clockwise ordering for box mode
  private readonly boxClockwise = [
    GridLocation.NORTHEAST,
    GridLocation.SOUTHEAST,
    GridLocation.SOUTHWEST,
    GridLocation.NORTHWEST,
  ];

  /**
   * Calculate the motion type between two grid locations
   */
  calculateMotionType(
    from: GridLocation,
    to: GridLocation,
    gridMode: GridMode
  ): HandMotionType {
    // Same position = static
    if (from === to) {
      return HandMotionType.STATIC;
    }

    const positions = this.getActivePositions(gridMode);

    // Validate that both positions are in the active set
    if (!positions.includes(from) || !positions.includes(to)) {
      throw new Error(
        `Invalid positions for ${gridMode} mode: from=${from}, to=${to}`
      );
    }

    const fromIndex = positions.indexOf(from);
    const toIndex = positions.indexOf(to);

    // Check if adjacent (1 step clockwise or counter-clockwise)
    const isAdjacentCW = (fromIndex + 1) % 4 === toIndex;
    const isAdjacentCCW = (fromIndex - 1 + 4) % 4 === toIndex;

    if (isAdjacentCW || isAdjacentCCW) {
      return HandMotionType.SHIFT;
    }

    // Opposite position (2 steps away)
    const isOpposite = (fromIndex + 2) % 4 === toIndex;
    if (isOpposite) {
      return HandMotionType.DASH;
    }

    throw new Error(`Unexpected position relationship: from=${from}, to=${to}`);
  }

  /**
   * Determine the rotation direction for a shift motion
   * Returns null for STATIC and DASH motions
   */
  calculateRotationDirection(
    from: GridLocation,
    to: GridLocation,
    gridMode: GridMode
  ): RotationDirection | null {
    const motionType = this.calculateMotionType(from, to, gridMode);

    // Only SHIFT motions have rotation direction
    if (motionType !== HandMotionType.SHIFT) {
      return null;
    }

    const positions = this.getActivePositions(gridMode);
    const fromIndex = positions.indexOf(from);
    const toIndex = positions.indexOf(to);

    // Clockwise if moving forward in the array
    const isClockwise = (fromIndex + 1) % 4 === toIndex;

    return isClockwise
      ? RotationDirection.CLOCKWISE
      : RotationDirection.COUNTER_CLOCKWISE;
  }

  /**
   * Check if a position is valid for the given grid mode
   */
  isPositionEnabled(position: GridLocation, gridMode: GridMode): boolean {
    const activePositions = this.getActivePositions(gridMode);
    return activePositions.includes(position);
  }

  /**
   * Get all valid positions for a grid mode
   */
  getActivePositions(gridMode: GridMode): GridLocation[] {
    if (gridMode === GridMode.DIAMOND) {
      return [...this.diamondClockwise];
    } else if (gridMode === GridMode.BOX) {
      return [...this.boxClockwise];
    }

    throw new Error(`Unsupported grid mode: ${gridMode}`);
  }

  /**
   * Get the opposite position on the grid
   */
  getOppositePosition(
    position: GridLocation,
    gridMode: GridMode
  ): GridLocation {
    const positions = this.getActivePositions(gridMode);
    const index = positions.indexOf(position);

    if (index === -1) {
      throw new Error(`Invalid position ${position} for grid mode ${gridMode}`);
    }

    return positions[(index + 2) % 4]!;
  }

  /**
   * Get adjacent positions (clockwise and counter-clockwise)
   */
  getAdjacentPositions(
    position: GridLocation,
    gridMode: GridMode
  ): { clockwise: GridLocation; counterClockwise: GridLocation } {
    const positions = this.getActivePositions(gridMode);
    const index = positions.indexOf(position);

    if (index === -1) {
      throw new Error(`Invalid position ${position} for grid mode ${gridMode}`);
    }

    return {
      clockwise: positions[(index + 1) % 4]!,
      counterClockwise: positions[(index - 1 + 4) % 4]!,
    };
  }
}
