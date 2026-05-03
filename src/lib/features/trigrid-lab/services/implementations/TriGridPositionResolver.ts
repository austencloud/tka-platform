/**
 * TriGridPositionResolver - Classifies hand placements into trigrid positions.
 *
 * Same vertex = beta, different vertices = gamma.
 * No alpha positions exist on the trigrid (no opposite points).
 */

import type { GridLocation } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import type { TriGridMode, TriGridPositionInfo } from "../../domain/trigrid-types";
import { resolveTriGridPosition } from "../../domain/trigrid-positions";

export class TriGridPositionResolver {
  resolvePosition(
    blueLocation: GridLocation,
    redLocation: GridLocation,
    mode: TriGridMode,
  ): TriGridPositionInfo | null {
    return resolveTriGridPosition(blueLocation, redLocation, mode);
  }
}
