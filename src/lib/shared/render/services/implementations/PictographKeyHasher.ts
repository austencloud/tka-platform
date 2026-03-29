/**
 * PictographKeyHasher
 *
 * Generates deterministic cache keys for pictograph configurations.
 *
 * The key includes all properties that affect the visual SVG output,
 * but explicitly EXCLUDES stepNumber and size to enable cache sharing
 * across sequences with identical pictographs.
 */

import type { StepData } from "$lib/features/create/shared/domain/models/StepData";
import type { MotionData } from "$lib/shared/pictograph/shared/domain/models/MotionData";
import type { PictographData } from "$lib/shared/pictograph/shared/domain/models/PictographData";
import type { PictographVisibilityOptions } from "$lib/shared/render/utils/pictograph-to-svg";
import type { IPictographKeyHasher } from "../contracts/IPictographKeyHasher";
import { GridLocation, GridMode } from "$lib/shared/pictograph/grid/domain/enums/grid-enums";
import { getSettings } from "$lib/shared/application/state/app-state.svelte";

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
    handPathMode: boolean;
    handPointVisibility: string;
    printMode: boolean;
  };
}

export class PictographKeyHasher implements IPictographKeyHasher {
  deriveKey(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): string {
    const input = this.buildKeyInput(data, visibility);
    return this.computeHash(input);
  }

  /**
   * Build the key input object from pictograph data
   */
  private buildKeyInput(
    data: StepData | PictographData,
    visibility: PictographVisibilityOptions
  ): PictographKeyInput {
    // Guard against missing motions data
    const motions = data.motions ?? { blue: undefined, red: undefined };

    // Fall back to global settings for prop types when not explicitly provided.
    // The renderer (PictographPreparer) does the same fallback, so the cache key
    // must match. Without this, changing the global prop type setting (e.g. from
    // staff to fan) would serve stale cached images rendered with the old prop type.
    const globalSettings = getSettings();
    const resolvedBlueProp = visibility.bluePropType ?? globalSettings.bluePropType ?? "staff";
    const resolvedRedProp = visibility.redPropType ?? globalSettings.redPropType ?? "staff";

    return {
      letter: data.letter ?? undefined,
      blue: this.extractMotionKey(motions.blue),
      red: this.extractMotionKey(motions.red),
      visibility: {
        showTKA: visibility.showTKA ?? true,
        showVTG: visibility.showVTG ?? false,
        showElemental: visibility.showElemental ?? false,
        showPositions: visibility.showPositions ?? false,
        showReversals: visibility.showReversals ?? true,
        showNonRadialPoints: visibility.showNonRadialPoints ?? true,
        darkMode: visibility.darkMode ?? false,
        bluePropType: resolvedBlueProp,
        redPropType: resolvedRedProp,
        handPathMode: visibility.handPathMode ?? false,
        handPointVisibility: visibility.handPointVisibility ?? "all",
        printMode: visibility.printMode ?? false,
      },
    };
  }

  /**
   * Extract key-relevant properties from motion data
   */
  private extractMotionKey(motion: MotionData | undefined): MotionKeyData | null {
    if (!motion) return null;

    // Derive gridMode from locations instead of using potentially stale motion.gridMode
    // This ensures box mode pictographs get different cache keys than diamond mode
    const derivedGridMode = this.deriveGridModeFromLocations(
      motion.startLocation,
      motion.endLocation
    );

    return {
      motionType: motion.motionType ?? "",
      startLocation: motion.startLocation ?? "",
      endLocation: motion.endLocation ?? "",
      turns: motion.turns ?? 0,
      startOrientation: motion.startOrientation ?? "",
      endOrientation: motion.endOrientation ?? "",
      rotationDirection: motion.rotationDirection ?? "",
      propType: motion.propType ?? "staff",
      gridMode: derivedGridMode,
    };
  }

  /**
   * Derive grid mode from motion locations
   * Intercardinal (NE, SE, SW, NW) = BOX, Cardinal (N, E, S, W) = DIAMOND
   */
  private deriveGridModeFromLocations(
    startLocation: GridLocation | undefined,
    endLocation: GridLocation | undefined
  ): string {
    const intercardinalLocations = [
      GridLocation.NORTHEAST,
      GridLocation.SOUTHEAST,
      GridLocation.SOUTHWEST,
      GridLocation.NORTHWEST,
    ];

    // If either location is intercardinal, it's box mode
    if (
      (startLocation && intercardinalLocations.includes(startLocation)) ||
      (endLocation && intercardinalLocations.includes(endLocation))
    ) {
      return GridMode.BOX;
    }

    return GridMode.DIAMOND;
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

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
export const pictographKeyHasher = new PictographKeyHasher();
