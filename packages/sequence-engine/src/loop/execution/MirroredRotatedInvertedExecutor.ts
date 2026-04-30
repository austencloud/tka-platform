/**
 * Mirrored Rotated Inverted LOOP Executor
 *
 * Composes two operations sequentially:
 * 1. ROTATED (with user-selected period)
 * 2. MIRRORED_INVERTED (doubles with inverted mirroring)
 *
 * Requires start position on the vertical axis (self-mirroring).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import { Period } from "../loop-types.js";
import { VERTICAL_MIRROR_POSITION_MAP } from "../position-maps/strict-loop-position-maps.js";
import { strictRotatedExecutor } from "./StrictRotatedExecutor.js";
import { mirroredInvertedExecutor } from "./MirroredInvertedExecutor.js";

export class MirroredRotatedInvertedExecutor implements ILOOPExecutor {
  constructor(
    private readonly rotatedExecutor: ILOOPExecutor = strictRotatedExecutor,
    private readonly mirroredInvExecutor: ILOOPExecutor = mirroredInvertedExecutor
  ) {}

  executeLOOP(sequence: SequenceStep[], period: Period): SequenceStep[] {
    const startPos = sequence[0]?.startPosition;
    if (startPos) {
      const mirroredPos = VERTICAL_MIRROR_POSITION_MAP[startPos];
      if (mirroredPos && mirroredPos !== startPos) {
        throw new Error(
          `Mirrored-rotated-inverted LOOP requires a start position on the vertical axis. ` +
          `Got ${startPos} which mirrors to ${mirroredPos}.`
        );
      }
    }

    const rotatedSequence = this.rotatedExecutor.executeLOOP(sequence, period);
    const finalSequence = this.mirroredInvExecutor.executeLOOP(rotatedSequence, Period.HALVED);
    return finalSequence;
  }
}

export const mirroredRotatedInvertedExecutor = new MirroredRotatedInvertedExecutor();
