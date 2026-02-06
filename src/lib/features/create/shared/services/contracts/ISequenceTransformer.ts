/**
 * Sequence Transformation Service Interface
 *
 * Pure transformation functions for sequences.
 * All transforms support optional targetHand parameter to transform only specific hand(s):
 * - "blue": Only transform blue motion
 * - "red": Only transform red motion
 * - "both": Transform both motions (default)
 *
 * For single-hand transforms, positions and letters are derived from the combined
 * motion configuration after transforming only the selected hand.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { TargetHand } from "../../domain/types/panel-types";

export interface ISequenceTransformer {
  /**
   * Clear all steps in a sequence (make them blank)
   */
  clearSequence(sequence: SequenceData): SequenceData;

  /**
   * Duplicate a sequence with new IDs
   */
  duplicateSequence(sequence: SequenceData, newName?: string): SequenceData;

  /**
   * Mirror sequence (reverse movement and rotation patterns)
   * For single-hand transforms, derives new positions and looks up new letters.
   * @param targetHand - Which hand(s) to transform. Defaults to "both".
   */
  mirrorSequence(
    sequence: SequenceData,
    targetHand?: TargetHand
  ): Promise<SequenceData>;

  /**
   * Flip sequence vertically (flip north/south)
   * - Flips all positions using horizontal mirror map
   * - Flips all locations (north ↔ south)
   * - Reverses rotation directions (cw ↔ ccw)
   * - Grid mode stays the same
   * For single-hand transforms, derives new positions and looks up new letters.
   * @param targetHand - Which hand(s) to transform. Defaults to "both".
   */
  flipSequence(
    sequence: SequenceData,
    targetHand?: TargetHand
  ): Promise<SequenceData>;

  /**
   * Invert sequence rotation directions and motion types
   * - Flips all rotation directions (cw ↔ ccw)
   * - Flips all motion types (PRO ↔ ANTI)
   * - Positions and locations stay the same
   * - Looks up new letters based on changed rotation directions and motion types
   * - Changes the actual letters of the sequence
   * @param targetHand - Which hand(s) to transform. Defaults to "both".
   */
  invertSequence(
    sequence: SequenceData,
    targetHand?: TargetHand
  ): Promise<SequenceData>;

  /**
   * Swap blue and red colors (reversal flags)
   * Note: This operation only makes sense for both hands and ignores targetHand.
   */
  swapColors(sequence: SequenceData): SequenceData;

  /**
   * Rotate sequence positions
   * For single-hand transforms, also looks up new letters.
   * @param targetHand - Which hand(s) to transform. Defaults to "both".
   */
  rotateSequence(
    sequence: SequenceData,
    rotationAmount: number,
    targetHand?: TargetHand
  ): Promise<SequenceData>;

  /**
   * Rewind sequence (play backwards)
   * - Creates new start position from final beat's end state
   * - Rewinds beat order and transforms each beat
   * - Swaps positions, locations, orientations; flips rotation direction
   * - Looks up correct letters from pictograph dataset based on rewound motion configuration
   * Note: Beat reordering only happens when both hands are selected.
   * @param targetHand - Which hand(s) to transform. Defaults to "both".
   */
  rewindSequence(
    sequence: SequenceData,
    targetHand?: TargetHand
  ): Promise<SequenceData>;

  /**
   * Shift the start position of a sequence
   * - For circular: rotates steps so target beat's end becomes new start
   * - For non-circular: truncates steps before target
   */
  shiftStartPosition(
    sequence: SequenceData,
    targetStepNumber: number
  ): SequenceData;

  /**
   * Derive correct letters for all steps in a sequence.
   * Used as Phase 2 after synchronous transforms to update letters asynchronously.
   * This allows smooth CSS animations while still getting correct letter values.
   */
  deriveSequenceLetters(sequence: SequenceData): Promise<SequenceData>;
}
