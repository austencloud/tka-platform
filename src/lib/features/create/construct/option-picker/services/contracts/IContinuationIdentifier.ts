import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";

/**
 * Identifies the continuation option for a given beat.
 *
 * The continuation is the option where each hand continues
 * its shift direction (CW or CCW around the grid points).
 */
export interface IContinuationIdentifier {
  identifyContinuation(
    referenceBeat: PictographData,
    candidates: PictographData[]
  ): PictographData | null;
}
