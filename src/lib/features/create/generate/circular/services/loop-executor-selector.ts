import { LOOPType } from "../domain/models/circular-models";
import type { ILOOPExecutor } from "./ILOOPExecutor";

/**
 * Service for selecting the appropriate LOOP executor based on LOOP type
 *
 * Provides dependency injection-based executor selection, resolving
 * the correct executor instance from the ITI container based
 * on the requested LOOP type.
 */
export class LOOPExecutorSelector {
  constructor(
    private readonly strictRotatedExecutor: ILOOPExecutor,
    private readonly strictMirroredExecutor: ILOOPExecutor,
    private readonly strictFlippedExecutor: ILOOPExecutor,
    private readonly strictSwappedExecutor: ILOOPExecutor,
    private readonly strictInvertedExecutor: ILOOPExecutor,
    private readonly mirroredSwappedExecutor: ILOOPExecutor,
    private readonly swappedInvertedExecutor: ILOOPExecutor,
    private readonly mirroredInvertedExecutor: ILOOPExecutor,
    private readonly rotatedSwappedExecutor: ILOOPExecutor,
    private readonly rotatedInvertedExecutor: ILOOPExecutor,
    private readonly mirroredRotatedExecutor: ILOOPExecutor,
    private readonly mirroredRotatedInvertedExecutor: ILOOPExecutor,
    private readonly mirroredSwappedInvertedExecutor: ILOOPExecutor,
    private readonly mirroredRotatedInvertedSwappedExecutor: ILOOPExecutor,
    private readonly rewoundLOOPExecutor: ILOOPExecutor,
    private readonly rotatedSwappedInvertedExecutor: ILOOPExecutor
  ) {}

  /**
   * Get the appropriate LOOP executor for the given LOOP type
   */
  getExecutor(loopType: LOOPType): ILOOPExecutor {
    switch (loopType) {
      case LOOPType.ROTATED:
        return this.strictRotatedExecutor;

      case LOOPType.MIRRORED:
        return this.strictMirroredExecutor;

      case LOOPType.FLIPPED:
        return this.strictFlippedExecutor;

      case LOOPType.SWAPPED:
        return this.strictSwappedExecutor;

      case LOOPType.INVERTED:
        return this.strictInvertedExecutor;

      case LOOPType.MIRRORED_SWAPPED:
        return this.mirroredSwappedExecutor;

      case LOOPType.SWAPPED_INVERTED:
        return this.swappedInvertedExecutor;

      case LOOPType.MIRRORED_INVERTED:
        return this.mirroredInvertedExecutor;

      case LOOPType.ROTATED_SWAPPED:
        return this.rotatedSwappedExecutor;

      case LOOPType.ROTATED_INVERTED:
        return this.rotatedInvertedExecutor;

      case LOOPType.MIRRORED_ROTATED:
        return this.mirroredRotatedExecutor;

      case LOOPType.MIRRORED_INVERTED_ROTATED:
        return this.mirroredRotatedInvertedExecutor;

      case LOOPType.MIRRORED_SWAPPED_INVERTED:
        return this.mirroredSwappedInvertedExecutor;

      case LOOPType.ROTATED_SWAPPED_INVERTED:
        return this.rotatedSwappedInvertedExecutor;

      case LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED:
        return this.mirroredRotatedInvertedSwappedExecutor;

      case LOOPType.STRICT_REWOUND:
        return this.rewoundLOOPExecutor;

      default:
        throw new Error(
          `LOOP type "${loopType}" is not yet implemented. ` +
            `Currently supported: ROTATED, MIRRORED, FLIPPED, SWAPPED, ` +
            `INVERTED, MIRRORED_SWAPPED, SWAPPED_INVERTED, MIRRORED_INVERTED, ` +
            `ROTATED_SWAPPED, ROTATED_INVERTED, MIRRORED_ROTATED, MIRRORED_INVERTED_ROTATED, ` +
            `MIRRORED_SWAPPED_INVERTED, ROTATED_SWAPPED_INVERTED, MIRRORED_ROTATED_INVERTED_SWAPPED, REWOUND`
        );
    }
  }

  /**
   * Check if a LOOP type is supported
   */
  isSupported(loopType: LOOPType): boolean {
    return [
      LOOPType.ROTATED,
      LOOPType.MIRRORED,
      LOOPType.FLIPPED,
      LOOPType.SWAPPED,
      LOOPType.INVERTED,
      LOOPType.MIRRORED_SWAPPED,
      LOOPType.SWAPPED_INVERTED,
      LOOPType.MIRRORED_INVERTED,
      LOOPType.ROTATED_SWAPPED,
      LOOPType.ROTATED_INVERTED,
      LOOPType.MIRRORED_ROTATED,
      LOOPType.MIRRORED_INVERTED_ROTATED,
      LOOPType.MIRRORED_SWAPPED_INVERTED,
      LOOPType.ROTATED_SWAPPED_INVERTED,
      LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
      LOOPType.STRICT_REWOUND,
    ].includes(loopType);
  }
}

import { strictRotatedLOOPExecutor } from "./strict-rotated-loop-executor";
import { strictMirroredLOOPExecutor } from "./strict-mirrored-loop-executor";
import { strictFlippedLOOPExecutor } from "./strict-flipped-loop-executor";
import { strictSwappedLOOPExecutor } from "./strict-swapped-loop-executor";
import { strictInvertedLOOPExecutor } from "./strict-inverted-loop-executor";
import { mirroredSwappedLOOPExecutor } from "./mirrored-swapped-loop-executor";
import { swappedInvertedLOOPExecutor } from "./swapped-inverted-loop-executor";
import { mirroredInvertedLOOPExecutor } from "./mirrored-inverted-loop-executor";
import { rotatedSwappedLOOPExecutor } from "./rotated-swapped-loop-executor";
import { rotatedInvertedLOOPExecutor } from "./rotated-inverted-loop-executor";
import { mirroredRotatedLOOPExecutor } from "./mirrored-rotated-loop-executor";
import { mirroredRotatedInvertedLOOPExecutor } from "./mirrored-rotated-inverted-loop-executor";
import { mirroredSwappedInvertedLOOPExecutor } from "./mirrored-swapped-inverted-loop-executor";
import { mirroredRotatedInvertedSwappedLOOPExecutor } from "./mirrored-rotated-inverted-swapped-loop-executor";
import { rewoundLOOPExecutor } from "./rewound-loop-executor";
import { rotatedSwappedInvertedLOOPExecutor } from "./rotated-swapped-inverted-loop-executor";

export const loopExecutorSelector = new LOOPExecutorSelector(
  strictRotatedLOOPExecutor,
  strictMirroredLOOPExecutor,
  strictFlippedLOOPExecutor,
  strictSwappedLOOPExecutor,
  strictInvertedLOOPExecutor,
  mirroredSwappedLOOPExecutor,
  swappedInvertedLOOPExecutor,
  mirroredInvertedLOOPExecutor,
  rotatedSwappedLOOPExecutor,
  rotatedInvertedLOOPExecutor,
  mirroredRotatedLOOPExecutor,
  mirroredRotatedInvertedLOOPExecutor,
  mirroredSwappedInvertedLOOPExecutor,
  mirroredRotatedInvertedSwappedLOOPExecutor,
  rewoundLOOPExecutor,
  rotatedSwappedInvertedLOOPExecutor
);
