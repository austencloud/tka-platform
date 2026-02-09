/**
 * ITopologyPositionEnumerator - Enumerates valid hand positions across a topology
 *
 * For a given topology, computes all hand point locations and all (blue, red)
 * position pair combinations. Used by the Multi-Grid Lab for auto-cycling
 * through every placement.
 */

import type { GridTopology, PointRef } from "../../domain/models/GridTopology";

/**
 * A pair of prop placements: one blue, one red.
 * Each references a specific grid:location.
 */
export interface PositionPair {
  readonly blue: PointRef;
  readonly red: PointRef;
}

export interface ITopologyPositionEnumerator {
  /** All valid hand point locations across all grids in the topology */
  enumerateHandPoints(topology: GridTopology): PointRef[];

  /** All (blue, red) position pair combinations across the topology */
  enumeratePositionPairs(topology: GridTopology): PositionPair[];
}
