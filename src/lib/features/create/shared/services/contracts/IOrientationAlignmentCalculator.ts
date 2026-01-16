/**
 * Orientation Alignment Calculator Interface
 *
 * Calculates orientation alignment for sequence extension.
 * Used to determine how many repetitions are needed for orientations
 * to return to their starting state.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { OrientationAlignment } from "./ISequenceExtender";

export interface IOrientationAlignmentCalculator {
  /**
   * Get the starting orientations from a sequence's start position.
   * Checks multiple data formats (motions, legacy blue/red properties).
   *
   * @param sequence - The sequence to extract orientations from
   * @returns Object with blueOri and redOri, or null if not available
   */
  getStartOrientations(
    sequence: SequenceData
  ): { blueOri: string; redOri: string } | null;

  /**
   * Calculate how many steps an orientation needs to return to its original.
   * Orientations cycle: in → clock → out → counter → in (4 states)
   *
   * @param startOri - Original orientation
   * @param endOri - Final orientation after one sequence pass
   * @returns Number of passes needed: 1 (same), 2 (opposite), or 4 (quarter-step)
   */
  calculateOrientationSteps(startOri: string, endOri: string): 1 | 2 | 4;

  /**
   * Calculate orientation alignment between sequence start and a potential end position.
   * Used for "exact position" options to show how many repetitions are needed.
   *
   * @param sequence - The current sequence
   * @param bridgePictograph - The pictograph data for the bridge letter
   * @returns OrientationAlignment info or null if can't be calculated
   */
  calculateOrientationAlignment(
    sequence: SequenceData,
    bridgePictograph: PictographData
  ): OrientationAlignment | null;

  /**
   * Calculate the resulting sequence length after applying a LOOP.
   *
   * @param currentLength - Current sequence length (number of steps)
   * @param rotationRelation - The rotation relation (exact, half, quarter)
   * @param repetitionsNeeded - For exact position, how many repetitions needed
   * @returns The final sequence length
   */
  calculateResultingLength(
    currentLength: number,
    rotationRelation: "exact" | "half" | "quarter" | null,
    repetitionsNeeded?: 1 | 2 | 4
  ): number;
}
