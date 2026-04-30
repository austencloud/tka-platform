/**
 * Mirrored Rotated LOOP Executor
 *
 * Composes two operations sequentially:
 * 1. ROTATED (with user-selected period)
 * 2. MIRRORED (doubles again with vertical mirroring)
 *
 * Requires start position on the vertical axis (self-mirroring).
 */

import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import { Period } from "../loop-types.js";
import { VERTICAL_MIRROR_POSITION_MAP } from "../position-maps/strict-loop-position-maps.js";
import { strictRotatedExecutor } from "./StrictRotatedExecutor.js";
import { strictMirroredExecutor } from "./StrictMirroredExecutor.js";

export class MirroredRotatedExecutor implements ILOOPExecutor {
  constructor(
    private readonly rotatedExecutor: ILOOPExecutor = strictRotatedExecutor,
    private readonly mirroredExecutor: ILOOPExecutor = strictMirroredExecutor
  ) {}

  executeLOOP(sequence: SequenceStep[], period: Period): SequenceStep[] {
    const startPos = sequence[0]?.startPosition;
    if (startPos) {
      const mirroredPos = VERTICAL_MIRROR_POSITION_MAP[startPos];
      if (mirroredPos && mirroredPos !== startPos) {
        throw new Error(
          `Mirrored-rotated LOOP requires a start position on the vertical axis ` +
          `(where vertical_mirror(pos) == pos). Got ${startPos} which mirrors to ${mirroredPos}.`
        );
      }
    }

    const rotatedSequence = this.rotatedExecutor.executeLOOP(sequence, period);
    const finalSequence = this.mirroredExecutor.executeLOOP(rotatedSequence, Period.HALVED);
    return finalSequence;
  }
}

export const mirroredRotatedExecutor = new MirroredRotatedExecutor();
