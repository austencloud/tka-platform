import type { GridTopology } from "$lib/shared/multi-grid/domain/models/grid-topology";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/pictograph-data";
import type { PropPlacement } from "$lib/shared/conjoined-grid/domain/types";
import { MotionColor } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { GridLocation } from "$lib/shared/render/core/types";

/**
 * Maps a pictograph's blue and red prop end positions onto a multi-grid topology.
 *
 * For 2-grid topologies the convention is: blue prop belongs to the first grid,
 * red prop belongs to the second grid. The mapper reads each motion's endLocation
 * (a compass point like "n", "se", etc.) and pairs it with the corresponding
 * grid ID from the topology.
 *
 * Returns null when the pictograph lacks motion data for either hand or the
 * topology doesn't have at least two grids.
 */
export function mapToTopology(
  pictograph: PictographData,
  topology: GridTopology,
): PropPlacement | null {
  if (topology.grids.length < 2) return null;

  const blueMotion = pictograph.motions[MotionColor.BLUE];
  const redMotion = pictograph.motions[MotionColor.RED];

  if (!blueMotion || !redMotion) return null;

  const blueEnd = blueMotion.endLocation as GridLocation;
  const redEnd = redMotion.endLocation as GridLocation;

  const gridA = topology.grids[0]!;
  const gridB = topology.grids[1]!;

  return {
    blue: { gridId: gridA.id, location: blueEnd },
    red: { gridId: gridB.id, location: redEnd },
  };
}
