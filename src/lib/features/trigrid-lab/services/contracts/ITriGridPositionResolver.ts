/**
 * ITriGridPositionResolver - Classifies hand placements into positions.
 *
 * Same vertex = beta, different vertices = gamma.
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { TriGridMode, TriGridPositionInfo } from "../../domain/trigrid-types";

export interface ITriGridPositionResolver {
  /** Resolve the position classification for two hand locations */
  resolvePosition(
    blueLocation: GridLocation,
    redLocation: GridLocation,
    mode: TriGridMode,
  ): TriGridPositionInfo | null;
}
