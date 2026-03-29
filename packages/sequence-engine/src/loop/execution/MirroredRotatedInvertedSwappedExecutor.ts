/**
 * Mirrored Rotated Inverted Swapped LOOP Executor
 *
 * Composes two operations sequentially:
 * 1. ROTATED (with user-selected slice size)
 * 2. MIRRORED_SWAPPED_INVERTED (all three transformations together)
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import { SliceSize } from "../loop-types.js";
import { strictRotatedExecutor } from "./StrictRotatedExecutor.js";
import { mirroredSwappedInvertedExecutor } from "./MirroredSwappedInvertedExecutor.js";

export class MirroredRotatedInvertedSwappedExecutor implements ILOOPExecutor {
  constructor(
    private readonly rotatedExecutor: ILOOPExecutor = strictRotatedExecutor,
    private readonly mirroredSwappedInvExecutor: ILOOPExecutor = mirroredSwappedInvertedExecutor
  ) {}

  executeLOOP(sequence: SequenceStep[], sliceSize: SliceSize): SequenceStep[] {
    const rotatedSequence = this.rotatedExecutor.executeLOOP(sequence, sliceSize);
    const finalSequence = this.mirroredSwappedInvExecutor.executeLOOP(
      rotatedSequence,
      SliceSize.HALVED
    );
    return finalSequence;
  }
}

export const mirroredRotatedInvertedSwappedExecutor = new MirroredRotatedInvertedSwappedExecutor();
