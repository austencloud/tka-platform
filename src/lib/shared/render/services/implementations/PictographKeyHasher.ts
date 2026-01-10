/**
 * PictographKeyHasher
 *
 * Generates deterministic cache keys for pictograph configurations.
 *
 * The key includes all properties that affect the visual SVG output,
 * but explicitly EXCLUDES beatNumber and size to enable cache sharing
 * across sequences with identical pictographs.
 */

import type { BeatData } from "$lib/features/create/shared/domain/models/BeatData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";
import type { IPictographKeyHasher } from "../contracts/IPictographKeyHasher";

/**
 * Internal structure for motion key data
 */
interface MotionKeyData {
  motionType: string;
  startLocation: string;
  endLocation: string;
  turns: number | string;
  startOrientation: string;
  endOrientation: string;
  rotationDirection: string;
  propType: string;
  gridMode: string;
}

/**
 * Internal structure for the complete key input
 */
interface PictographKeyInput {
  letter: string | undefined;
  blue: MotionKeyData | null;
  red: MotionKeyData | null;
  visibility: {
    showTKA: boolean;
    showVTG: boolean;
    showElemental: boolean;
    showPositions: boolean;
    showReversals: boolean;
    showNonRadialPoints: boolean;
    darkMode: boolean;
    bluePropType: string | undefined;
    redPropType: string | undefined;
  };
}

export class PictographKeyHasher implements IPictographKeyHasher {
  deriveKey(
    data: BeatData | PictographData,
    visibility: PictographVisibilityOptions
  ): string {
    const input = this.buildKeyInput(data, visibility);
    return this.computeHash(input);
  }

  /**
   * Build the key input object from pictograph data
   */
  private buildKeyInput(
    data: BeatData | PictographData,
    visibility: PictographVisibilityOptions
  ): PictographKeyInput {
    return {
      letter: data.letter ?? undefined,
      blue: this.extractMotionKey(data.motions.blue),
      red: this.extractMotionKey(data.motions.red),
      visibility: {
        showTKA: visibility.showTKA ?? true,
        showVTG: visibility.showVTG ?? false,
        showElemental: visibility.showElemental ?? false,
        showPositions: visibility.showPositions ?? false,
        showReversals: visibility.showReversals ?? true,
        showNonRadialPoints: visibility.showNonRadialPoints ?? true,
        darkMode: visibility.darkMode ?? false,
        bluePropType: visibility.bluePropType ?? undefined,
        redPropType: visibility.redPropType ?? undefined,
      },
    };
  }

  /**
   * Extract key-relevant properties from motion data
   */
  private extractMotionKey(motion: MotionData | undefined): MotionKeyData | null {
    if (!motion) return null;

    return {
      motionType: motion.motionType ?? "",
      startLocation: motion.startLocation ?? "",
      endLocation: motion.endLocation ?? "",
      turns: motion.turns ?? 0,
      startOrientation: motion.startOrientation ?? "",
      endOrientation: motion.endOrientation ?? "",
      rotationDirection: motion.rotationDirection ?? "",
      propType: motion.propType ?? "staff",
      gridMode: motion.gridMode ?? "diamond",
    };
  }

  /**
   * Compute a deterministic hash from the key input
   * Uses djb2 algorithm for fast, reasonable distribution
   */
  private computeHash(input: PictographKeyInput): string {
    // Sort keys for deterministic JSON serialization
    const str = JSON.stringify(input, this.sortedReplacer);

    // djb2 hash algorithm
    let hash = 5381;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0;
    }

    // Convert to base36 for shorter strings
    return Math.abs(hash).toString(36);
  }

  /**
   * JSON replacer that sorts object keys for deterministic serialization
   */
  private sortedReplacer = (_key: string, value: unknown): unknown => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return Object.keys(value as Record<string, unknown>)
        .sort()
        .reduce(
          (sorted, key) => {
            sorted[key] = (value as Record<string, unknown>)[key];
            return sorted;
          },
          {} as Record<string, unknown>
        );
    }
    return value;
  };
}
