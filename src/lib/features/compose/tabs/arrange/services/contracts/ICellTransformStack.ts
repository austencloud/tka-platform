/**
 * ICellTransformStack - Contract for non-destructive transform replay
 *
 * Manages an ordered stack of transforms applied to a sequence layer.
 * The original sequence is never mutated. Instead, transforms are replayed
 * from scratch to compute the effective (displayed) sequence.
 */

import type { SequenceData } from "$lib/shared/foundation/domain/models/SequenceData";
import type { AppliedTransform } from "$lib/features/compose/compose/domain/types";

export interface ICellTransformStack {
  /**
   * Replay all transforms in order against the original sequence.
   * Returns the original if the stack is empty.
   * Failed transforms are skipped (the last good state is carried forward).
   */
  computeEffective(
    original: SequenceData,
    stack: AppliedTransform[]
  ): Promise<SequenceData>;

  /**
   * Return a new stack with the given transform appended.
   * Does not mutate the input array.
   */
  push(
    stack: AppliedTransform[],
    type: AppliedTransform["type"],
    hand: AppliedTransform["hand"]
  ): AppliedTransform[];

  /**
   * Return a new stack with the last transform removed.
   * Does not mutate the input array.
   */
  pop(stack: AppliedTransform[]): AppliedTransform[];

  /**
   * Return an empty stack.
   */
  clear(): AppliedTransform[];
}
