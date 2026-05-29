import type {
  GridTopology,
  PointRef,
  Junction,
} from "$lib/shared/multi-grid/domain/models/grid-topology";
import type { JunctionOverlap, PropPlacement } from "$lib/shared/conjoined-grid/domain/types";

/**
 * Iterates over all junctions in a topology and checks whether both the blue
 * and red props occupy refs that map to the same junction. When they do,
 * that junction is reported as an overlap with distance 0.
 *
 * This generalizes to N junctions across arbitrary topologies: 2-grid chains,
 * 3-grid chains, 2x2 grids, mixed mode arrangements, etc.
 */
export function detectOverlaps(topology: GridTopology, placement: PropPlacement): JunctionOverlap[] {
  const overlaps: JunctionOverlap[] = [];

  for (const junction of topology.junctions) {
    const blueAtJunction = refMatchesJunction(placement.blue, junction);
    const redAtJunction = refMatchesJunction(placement.red, junction);

    if (blueAtJunction && redAtJunction) {
      overlaps.push({
        junction,
        blueRef: placement.blue,
        redRef: placement.red,
        distance: 0,
      });
    }
  }

  return overlaps;
}

/**
 * A PointRef matches a junction when any of the junction's refs share the
 * same gridId and location. This handles the case where a junction merges
 * refs from multiple grids (e.g., grid A's east = grid B's center).
 */
function refMatchesJunction(ref: PointRef, junction: Junction): boolean {
  return junction.refs.some((r) => r.gridId === ref.gridId && r.location === ref.location);
}
