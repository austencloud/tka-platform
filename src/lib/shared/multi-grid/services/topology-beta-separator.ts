/**
 * TopologyBetaSeparator - Detects and resolves prop overlap in topologies
 *
 * When blue and red props share the same world position (same grid:location,
 * or different grid:locations that map to the same junction), separates them
 * perpendicular to prevent visual overlap.
 *
 * Overlap detection uses world coordinates from the topology.
 * Separation distance uses getBetaOffsetSize() (same as pictograph pipeline).
 * Separation axis is perpendicular to the line between the two grids' centers,
 * or vertical if on the same grid (matching the standard beta offset direction).
 */

import type { GridTopology, PointRef, Vec2 } from "../domain/models/grid-topology";
import type { BetaOffset } from "./types";
import { getBetaOffsetSize } from "$lib/shared/pictograph/prop/domain/enums/PropClassification";
import { LOCATION_OFFSETS, PIXELS_PER_UNIT } from "../domain/constants/grid-mode-offsets";

const NO_OFFSET: BetaOffset = {
  blue: { x: 0, y: 0 },
  red: { x: 0, y: 0 },
};

/** Tolerance in SVG pixels for considering two positions as overlapping */
const OVERLAP_THRESHOLD_PX = 5;

export class TopologyBetaSeparator {
  calculateOffset(
    topology: GridTopology,
    blueRef: PointRef,
    redRef: PointRef,
    propType: string,
    gridMode: string,
  ): BetaOffset {
    // Find the world positions for both props
    const blueWorld = this.findWorldPosition(topology, blueRef);
    const redWorld = this.findWorldPosition(topology, redRef);
    if (!blueWorld || !redWorld) return NO_OFFSET;

    // Convert to SVG pixels for distance comparison
    const bluePx = { x: blueWorld.x * PIXELS_PER_UNIT, y: blueWorld.y * PIXELS_PER_UNIT };
    const redPx = { x: redWorld.x * PIXELS_PER_UNIT, y: redWorld.y * PIXELS_PER_UNIT };

    const dist = Math.hypot(bluePx.x - redPx.x, bluePx.y - redPx.y);
    if (dist >= OVERLAP_THRESHOLD_PX) return NO_OFFSET;

    // Props overlap - compute separation axis and distance
    const axis = this.computeSeparationAxis(topology, blueRef, redRef);
    const betaGridMode = gridMode === "box" ? "box" : "diamond";
    const offset = getBetaOffsetSize(propType, betaGridMode as "diamond" | "box");

    return {
      blue: { x: axis.x * offset, y: axis.y * offset },
      red: { x: -axis.x * offset, y: -axis.y * offset },
    };
  }

  /**
   * Find the world position for a PointRef by looking up the topology's worldPoints.
   * Returns position in abstract units (radius=1.0).
   */
  private findWorldPosition(topology: GridTopology, ref: PointRef): Vec2 | null {
    // Look through world points to find one with a matching ref
    for (const wp of topology.worldPoints) {
      for (const wpRef of wp.refs) {
        if (wpRef.gridId === ref.gridId && wpRef.location === ref.location) {
          return wp.position;
        }
      }
    }

    // Fallback: compute from grid placement + location offset
    const grid = topology.grids.find((g) => g.id === ref.gridId);
    if (!grid) return null;

    const locOffset = LOCATION_OFFSETS[ref.location];
    if (!locOffset) return null;

    return {
      x: grid.center.x + locOffset.x * grid.radius,
      y: grid.center.y + locOffset.y * grid.radius,
    };
  }

  /**
   * Compute the unit vector for separation direction.
   *
   * For cross-grid overlap (junction): perpendicular to the line between grid centers.
   * For same-grid overlap (beta position): default vertical axis (0, 1).
   */
  private computeSeparationAxis(
    topology: GridTopology,
    blueRef: PointRef,
    redRef: PointRef,
  ): Vec2 {
    if (blueRef.gridId === redRef.gridId) {
      // Same grid beta: separate vertically (matches standard pictograph behavior)
      return { x: 0, y: 1 };
    }

    // Cross-grid: separate perpendicular to the line between grid centers
    const gridA = topology.grids.find((g) => g.id === blueRef.gridId);
    const gridB = topology.grids.find((g) => g.id === redRef.gridId);
    if (!gridA || !gridB) return { x: 0, y: 1 };

    // Direction from A to B
    const dx = gridB.center.x - gridA.center.x;
    const dy = gridB.center.y - gridA.center.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.001) return { x: 0, y: 1 };

    // Perpendicular (rotate 90° CCW): (-dy, dx)
    return { x: -dy / len, y: dx / len };
  }
}
