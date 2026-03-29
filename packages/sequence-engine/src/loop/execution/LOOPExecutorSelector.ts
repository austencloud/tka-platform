/**
 * LOOP Executor Selector
 *
 * Selects the appropriate LOOP executor based on LOOP type.
 * All 14 LOOP types + rewound are supported.
 */

import { LOOPType } from "../loop-types.js";
import type { ILOOPExecutor } from "./ILOOPExecutor.js";
import { strictRotatedExecutor } from "./StrictRotatedExecutor.js";
import { strictMirroredExecutor } from "./StrictMirroredExecutor.js";
import { strictFlippedExecutor } from "./StrictFlippedExecutor.js";
import { strictSwappedExecutor } from "./StrictSwappedExecutor.js";
import { strictInvertedExecutor } from "./StrictInvertedExecutor.js";
import { mirroredSwappedExecutor } from "./MirroredSwappedExecutor.js";
import { swappedInvertedExecutor } from "./SwappedInvertedExecutor.js";
import { mirroredInvertedExecutor } from "./MirroredInvertedExecutor.js";
import { rotatedSwappedExecutor } from "./RotatedSwappedExecutor.js";
import { rotatedInvertedExecutor } from "./RotatedInvertedExecutor.js";
import { mirroredRotatedExecutor } from "./MirroredRotatedExecutor.js";
import { mirroredRotatedInvertedExecutor } from "./MirroredRotatedInvertedExecutor.js";
import { mirroredSwappedInvertedExecutor } from "./MirroredSwappedInvertedExecutor.js";
import { mirroredRotatedInvertedSwappedExecutor } from "./MirroredRotatedInvertedSwappedExecutor.js";
import { rewoundExecutor } from "./RewoundExecutor.js";

export class LOOPExecutorSelector {
  private readonly executorMap: Map<LOOPType, ILOOPExecutor>;

  constructor() {
    this.executorMap = new Map<LOOPType, ILOOPExecutor>([
      [LOOPType.ROTATED, strictRotatedExecutor],
      [LOOPType.MIRRORED, strictMirroredExecutor],
      [LOOPType.FLIPPED, strictFlippedExecutor],
      [LOOPType.SWAPPED, strictSwappedExecutor],
      [LOOPType.INVERTED, strictInvertedExecutor],
      [LOOPType.MIRRORED_SWAPPED, mirroredSwappedExecutor],
      [LOOPType.SWAPPED_INVERTED, swappedInvertedExecutor],
      [LOOPType.MIRRORED_INVERTED, mirroredInvertedExecutor],
      [LOOPType.ROTATED_SWAPPED, rotatedSwappedExecutor],
      [LOOPType.ROTATED_INVERTED, rotatedInvertedExecutor],
      [LOOPType.MIRRORED_ROTATED, mirroredRotatedExecutor],
      [LOOPType.MIRRORED_INVERTED_ROTATED, mirroredRotatedInvertedExecutor],
      [LOOPType.MIRRORED_SWAPPED_INVERTED, mirroredSwappedInvertedExecutor],
      [LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED, mirroredRotatedInvertedSwappedExecutor],
      [LOOPType.REWOUND, rewoundExecutor],
    ]);
  }

  /**
   * Get the appropriate LOOP executor for the given LOOP type
   */
  getExecutor(loopType: LOOPType): ILOOPExecutor {
    const executor = this.executorMap.get(loopType);
    if (!executor) {
      throw new Error(
        `LOOP type "${loopType}" is not supported. ` +
          `Supported types: ${Array.from(this.executorMap.keys()).join(", ")}`
      );
    }
    return executor;
  }

  /**
   * Check if a LOOP type is supported
   */
  isSupported(loopType: LOOPType): boolean {
    return this.executorMap.has(loopType);
  }
}

export const loopExecutorSelector = new LOOPExecutorSelector();
