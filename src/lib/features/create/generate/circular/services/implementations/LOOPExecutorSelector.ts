import { LOOPType } from "../../domain/models/circular-models";
import type { ILOOPExecutor } from "../contracts/ILOOPExecutor";

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
    private readonly rewoundLOOPExecutor: ILOOPExecutor
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
            `MIRRORED_ROTATED_INVERTED_SWAPPED, REWOUND`
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
      LOOPType.MIRRORED_ROTATED_INVERTED_SWAPPED,
      LOOPType.STRICT_REWOUND,
    ].includes(loopType);
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
import { strictRotatedLOOPExecutor } from "./StrictRotatedLOOPExecutor";
import { strictMirroredLOOPExecutor } from "./StrictMirroredLOOPExecutor";
import { strictFlippedLOOPExecutor } from "./StrictFlippedLOOPExecutor";
import { strictSwappedLOOPExecutor } from "./StrictSwappedLOOPExecutor";
import { strictInvertedLOOPExecutor } from "./StrictInvertedLOOPExecutor";
import { mirroredSwappedLOOPExecutor } from "./MirroredSwappedLOOPExecutor";
import { swappedInvertedLOOPExecutor } from "./SwappedInvertedLOOPExecutor";
import { mirroredInvertedLOOPExecutor } from "./MirroredInvertedLOOPExecutor";
import { rotatedSwappedLOOPExecutor } from "./RotatedSwappedLOOPExecutor";
import { rotatedInvertedLOOPExecutor } from "./RotatedInvertedLOOPExecutor";
import { mirroredRotatedLOOPExecutor } from "./MirroredRotatedLOOPExecutor";
import { mirroredRotatedInvertedLOOPExecutor } from "./MirroredRotatedInvertedLOOPExecutor";
import { mirroredSwappedInvertedLOOPExecutor } from "./MirroredSwappedInvertedLOOPExecutor";
import { mirroredRotatedInvertedSwappedLOOPExecutor } from "./MirroredRotatedInvertedSwappedLOOPExecutor";
import { rewoundLOOPExecutor } from "./RewoundLOOPExecutor";

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
  rewoundLOOPExecutor
);
