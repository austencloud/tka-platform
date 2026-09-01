/**
 * Topology Position Enumerator - Enumerates valid hand positions across a topology
 */

import type { GridTopology, PointRef } from "../domain/models/grid-topology";
import type { PositionPair } from "./types";
import { HAND_POINT_LOCATIONS } from "../domain/constants/grid-mode-offsets";

export function enumerateHandPoints(topology: GridTopology): PointRef[] {
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

export function enumeratePositionPairs(topology: GridTopology): PositionPair[] {
  const handPoints = enumerateHandPoints(topology);
  const pairs: PositionPair[] = [];

  for (const left of handPoints) {
    for (const right of handPoints) {
      pairs.push({ left, right });
    }
  }

  return pairs;
}
