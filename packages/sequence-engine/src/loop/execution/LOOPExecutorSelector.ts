/**
 * LOOP Executor Selector
 *
 * Routes all LOOP execution through the spec-executor pipeline.
 * Legacy getExecutor() is preserved for backward compatibility but
 * internally converts LOOPType → LOOPSpec → executeLOOPSpec.
 */

import { LOOPType, periodToNumber } from "../loop-types.js";
import type { LOOPSpec } from "../loop-spec.js";
import { loopSpecFromLegacy } from "../loop-spec.js";
import type { SequenceStep } from "../../core/types/sequence-engine-types.js";
import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import type { Period } from "../loop-types.js";
import { executeLOOPSpec } from "./spec-executor.js";

export class LOOPExecutorSelector {
  /** @deprecated Use executeSpec(sequence, spec) instead. */
  getExecutor(loopType: LOOPType): ILOOPExecutor {
    return {
      executeLOOP: (sequence: SequenceStep[], period: Period) => {
        const spec = loopSpecFromLegacy(loopType, periodToNumber(period));
        return executeLOOPSpec(sequence, spec);
      },
    };
  }

  executeSpec(sequence: SequenceStep[], spec: LOOPSpec): SequenceStep[] {
    return executeLOOPSpec(sequence, spec);
  }

  isSupported(loopType: LOOPType): boolean {
    return Object.values(LOOPType).includes(loopType);
  }
}

export const loopExecutorSelector = new LOOPExecutorSelector();
