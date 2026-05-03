/**
 * TopologyPositionEnumerator - Enumerates valid hand positions across a topology
 *
 * Given a GridTopology, produces:
 * 1. All hand point locations (PointRef[]) across all grids
 * 2. All (blue, red) position pair combinations
 *
 * Hand points are determined by grid mode:
 * - Diamond: n, e, s, w (4 per grid)
 * - Box: ne, se, sw, nw (4 per grid)
 * - Skewed: all 8 perimeter points
 *
 * For N grids with H hand points each: H*N total hand points,
 * (H*N)² total position pairs.
 */

import type { GridTopology, PointRef } from "../../domain/models/GridTopology";
import type { PositionPair } from "../contracts/types";
import { HAND_POINT_LOCATIONS } from "../../domain/constants/GridModeOffsets";

export class TopologyPositionEnumerator {
  enumerateHandPoints(topology: GridTopology): PointRef[] {
    const points: PointRef[] = [];

    for (const grid of topology.grids) {
      const locations = HAND_POINT_LOCATIONS[grid.mode];
      if (!locations) continue;

      for (const location of locations) {
        points.push({ gridId: grid.id, location });
      }
    }

    return points;
  }

  enumeratePositionPairs(topology: GridTopology): PositionPair[] {
    const handPoints = this.enumerateHandPoints(topology);
    const pairs: PositionPair[] = [];

    for (const blue of handPoints) {
      for (const red of handPoints) {
        pairs.push({ blue, red });
      }
    }

    return pairs;
  }
}
