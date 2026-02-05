/**
 * ConjoinedLayoutCalculator - Calculates positions for dual-grid layout
 *
 * Based on gridCoordinates.ts:
 * - Center: (475, 475)
 * - Outer points: 300px from center
 * - Full viewBox: 950x950 (0,0 to 950,950)
 */

import type { IConjoinedLayoutCalculator } from "../contracts/IConjoinedLayoutCalculator";
import type {
  ConjoinedLayout,
  GridPositions,
  CanvasDimensions,
  ConjoinedEdge,
} from "../../domain/types";

// Grid constants from gridCoordinates.ts
const GRID_CENTER = 475;
const GRID_SIZE = 950;
const OUTER_POINT_DISTANCE = 300;

// Diagonal distance (300 * sqrt(0.5) ≈ 212)
const DIAGONAL_DISTANCE = Math.round(OUTER_POINT_DISTANCE * Math.SQRT1_2);

export class ConjoinedLayoutCalculator implements IConjoinedLayoutCalculator {
  /**
   * Get the offset from grid center to the specified outer point.
   * These offsets represent where the outer points are relative to center (475, 475).
   */
  getOuterPointOffset(edge: ConjoinedEdge): { x: number; y: number } {
    const offsets: Record<ConjoinedEdge, { x: number; y: number }> = {
      n: { x: 0, y: -OUTER_POINT_DISTANCE },
      e: { x: OUTER_POINT_DISTANCE, y: 0 },
      s: { x: 0, y: OUTER_POINT_DISTANCE },
      w: { x: -OUTER_POINT_DISTANCE, y: 0 },
      ne: { x: DIAGONAL_DISTANCE, y: -DIAGONAL_DISTANCE },
      se: { x: DIAGONAL_DISTANCE, y: DIAGONAL_DISTANCE },
      sw: { x: -DIAGONAL_DISTANCE, y: DIAGONAL_DISTANCE },
      nw: { x: -DIAGONAL_DISTANCE, y: -DIAGONAL_DISTANCE },
    };
    return offsets[edge];
  }

  /**
   * Calculate the positions for both grids.
   *
   * Grid A is at origin (0,0). Grid B is offset so that:
   * - Grid B's center aligns with Grid A's conjoined-edge outer point
   * - Grid A's center aligns with Grid B's opposite outer point
   *
   * For "east" conjoined edge:
   *   Grid A center = (475, 475), east outer = (775, 475)
   *   Grid B needs its center at (775, 475) → Grid B origin at (775-475, 0) = (300, 0)
   *   Grid B's west outer = (175+300, 475) = (475, 475) = Grid A's center ✓
   *
   * The grids overlap by (GRID_SIZE - OUTER_POINT_DISTANCE) = 650px.
   */
  calculateGridPositions(layout: ConjoinedLayout): GridPositions {
    const { conjoinedEdge, spacing } = layout;

    // Grid A is at origin (0, 0) in viewBox coordinates
    const gridA = { x: 0, y: 0 };

    // Get the offset from grid center to the conjoined outer point
    const outerOffset = this.getOuterPointOffset(conjoinedEdge);

    // Grid B's origin = Grid A's outer point position - Grid B's center position
    // Grid A's outer point in global coords: (GRID_CENTER + outerOffset.x, GRID_CENTER + outerOffset.y)
    // Grid B's center in local coords: (GRID_CENTER, GRID_CENTER)
    // So Grid B's origin: (outerOffset.x, outerOffset.y)
    const spacingDir = this.getSpacingDirection(conjoinedEdge);

    const gridB = {
      x: outerOffset.x + spacing * spacingDir.x,
      y: outerOffset.y + spacing * spacingDir.y,
    };

    return { gridA, gridB };
  }

  /**
   * Get the direction vector for applying spacing based on the conjoined edge
   */
  private getSpacingDirection(edge: ConjoinedEdge): { x: number; y: number } {
    const directions: Record<ConjoinedEdge, { x: number; y: number }> = {
      n: { x: 0, y: -1 },
      e: { x: 1, y: 0 },
      s: { x: 0, y: 1 },
      w: { x: -1, y: 0 },
      ne: { x: 1, y: -1 },
      se: { x: 1, y: 1 },
      sw: { x: -1, y: 1 },
      nw: { x: -1, y: -1 },
    };
    const dir = directions[edge];
    // Normalize diagonal directions
    if (dir.x !== 0 && dir.y !== 0) {
      const len = Math.sqrt(dir.x * dir.x + dir.y * dir.y);
      return { x: dir.x / len, y: dir.y / len };
    }
    return dir;
  }

  /**
   * Calculate the canvas dimensions needed to contain both grids.
   * Returns the viewBox string and dimensions in pixels.
   */
  calculateCanvasDimensions(layout: ConjoinedLayout): CanvasDimensions {
    const positions = this.calculateGridPositions(layout);

    // Calculate bounds for both grids
    const gridABounds = {
      minX: positions.gridA.x,
      minY: positions.gridA.y,
      maxX: positions.gridA.x + GRID_SIZE,
      maxY: positions.gridA.y + GRID_SIZE,
    };

    const gridBBounds = {
      minX: positions.gridB.x,
      minY: positions.gridB.y,
      maxX: positions.gridB.x + GRID_SIZE,
      maxY: positions.gridB.y + GRID_SIZE,
    };

    // Combined bounds
    const minX = Math.min(gridABounds.minX, gridBBounds.minX);
    const minY = Math.min(gridABounds.minY, gridBBounds.minY);
    const maxX = Math.max(gridABounds.maxX, gridBBounds.maxX);
    const maxY = Math.max(gridABounds.maxY, gridBBounds.maxY);

    const width = maxX - minX;
    const height = maxY - minY;

    return {
      width,
      height,
      viewBox: `${minX} ${minY} ${width} ${height}`,
    };
  }
}
