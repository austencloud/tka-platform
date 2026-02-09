/**
 * ITopologyBetaSeparator - Detects and resolves prop overlap in topologies
 *
 * When blue and red props occupy the same world position (either same
 * grid:location or overlapping via a junction), offsets them perpendicular
 * to prevent visual overlap.
 *
 * Mirrors the conjoined beta separation logic from ConjoinedCanvas.svelte,
 * generalized for N-grid topologies.
 */

import type { GridTopology, PointRef, Vec2 } from "../../domain/models/GridTopology";

/** Pixel offsets to apply to each prop to separate them */
export interface BetaOffset {
  readonly blue: Vec2;
  readonly red: Vec2;
}

export interface ITopologyBetaSeparator {
  /**
   * Calculate separation offsets for blue and red props.
   *
   * Returns zero offsets if the props don't overlap.
   * When they do overlap, separates perpendicular to the line between
   * the two grid centers involved (or along a default axis for same-grid).
   *
   * @param topology - The current topology (for world point lookup)
   * @param blueRef - Blue prop's grid:location
   * @param redRef - Red prop's grid:location
   * @param propType - Prop type string (affects separation distance)
   * @param gridMode - Grid mode (affects separation distance for box mode)
   */
  calculateOffset(
    topology: GridTopology,
    blueRef: PointRef,
    redRef: PointRef,
    propType: string,
    gridMode: string,
  ): BetaOffset;
}
