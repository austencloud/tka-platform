/**
 * Rotation Override Manager
 *
 * Manages user-triggered rotation angle overrides for DASH and STATIC arrows.
 * Stores overrides in browser localStorage, allowing users to customize rotation
 * angles for specific pictograph configurations.
 *
 * IMPORTANT: Overrides are stored per-user in localStorage and persist across sessions.
 * This is the web equivalent of the desktop app's special placement JSON modification.
 */

import type { PictographData } from "../../../../shared/domain/models/pictograph-data";
import type { MotionData } from "../../../../shared/domain/models/motion-data";
import type { TurnsTupleGenerator } from "./turns-tuple-generator";
import {
  generateOrientationKey,
  resolveEffectiveOriKey,
} from "../../key-generation/services/special-placement-ori-key-generator";
import type { IRotationAngleOverrideKeyGenerator } from "../../key-generation/services/rotation-angle-override-key-generator";
import { deriveGridMode as _deriveGridMode } from "../../../../grid/services/grid-mode-deriver";
import { specialPlacer, type SpecialPlacer } from "./special-placer";
import {
  canonicalRotationOverrideData,
  clearRotationOverrides,
  loadRotationOverrides,
  saveRotationOverrides,
  type RotationOverrideData,
} from "./rotation-override-store";
import { placementFrameForGridMode } from "../domain/placement-frame";
import { PlacementFrame } from "../domain/placement-frame";
import { createCanonicalPlacementContext } from "../../calculation/services/canonical-placement-frame";

export interface IRotationOverrideManager {
  /**
   * Toggle rotation override for the given motion and pictograph.
   * Returns true if override is now active, false if removed.
   */
  toggleRotationOverride(
    motion: MotionData,
    pictographData: PictographData
  ): Promise<boolean>;

  /**
   * Check if rotation override is active for the given motion.
   */
  hasRotationOverride(
    motion: MotionData,
    pictographData: PictographData
  ): Promise<boolean>;

  /**
   * Clear all rotation overrides (for testing/reset).
   */
  clearAllOverrides(): void;

  /**
   * Export overrides as JSON (for backup/sharing).
   */
  exportOverrides(): string;

  /**
   * Import overrides from JSON (for restore/sharing).
   */
  importOverrides(jsonData: string): void;
}

export class RotationOverrideManager implements IRotationOverrideManager {
  constructor(
    private readonly tupleGenerator: TurnsTupleGenerator,
    private readonly rotationKeyGenerator: IRotationAngleOverrideKeyGenerator,
    private readonly specialPlacement: SpecialPlacer
  ) {}

  async toggleRotationOverride(
    motion: MotionData,
    pictographData: PictographData
  ): Promise<boolean> {
    const canonicalContext = createCanonicalPlacementContext(
      pictographData,
      motion
    );
    pictographData = canonicalContext.pictographData;
    motion = canonicalContext.motionData;
    // Validate motion type - only DASH and STATIC can have rotation overrides
    const motionType = motion.motionType.toLowerCase();
    if (motionType !== "dash" && motionType !== "static") {
      console.warn(
        `Rotation override not allowed for motion type: ${motionType}`
      );
      return false;
    }

    if (!pictographData.letter) {
      console.warn("No letter found in pictograph data");
      return false;
    }

    // Generate the effective oriKey - SpecialPlacer reads using this, so we
    // must save under it or the reader never sees the override. For staff+staff
    // this collapses to the legacy bucket (e.g. "from_layer1"); for other props
    // it preserves the specific orientation (e.g. "clock_counter").
    const rawOriKey = generateOrientationKey(motion, pictographData);
    const oriKey = resolveEffectiveOriKey(rawOriKey, pictographData);
    const placementFrame = this.getPlacementFrame(pictographData);
    const turnsTuple = this.tupleGenerator.generateTurnsTuple(pictographData);
    const rotationKey =
      this.rotationKeyGenerator.generateRotationAngleOverrideKey(
        motion,
        pictographData
      );
    const letter = pictographData.letter;

    // Load current overrides
    const overrides = this.loadOverrides();

    // Ensure structure exists
    if (!overrides[placementFrame]) overrides[placementFrame] = {};
    if (!overrides[placementFrame][oriKey])
      overrides[placementFrame][oriKey] = {};
    if (!overrides[placementFrame][oriKey][letter])
      overrides[placementFrame][oriKey][letter] = {};
    if (!overrides[placementFrame][oriKey][letter][turnsTuple])
      overrides[placementFrame][oriKey][letter][turnsTuple] = {};

    const turnsData = overrides[placementFrame][oriKey][letter][turnsTuple];

    // Toggle the effective state, including authored static JSON. Keeping an
    // explicit false value is necessary when the built-in placement flag is
    // true; deleting the local entry would immediately reveal that flag again.
    const isActive = await this.specialPlacement.hasRotationAngleOverride(
      motion,
      pictographData,
      rotationKey
    );
    turnsData[rotationKey] = !isActive;

    // Save updated overrides
    this.saveOverrides(overrides);

    // Return new state
    return !isActive;
  }

  async hasRotationOverride(
    motion: MotionData,
    pictographData: PictographData
  ): Promise<boolean> {
    // Validate motion type
    const motionType = motion.motionType.toLowerCase();
    if (motionType !== "dash" && motionType !== "static") {
      return false;
    }

    if (!pictographData.letter) {
      return false;
    }

    const rotationKey =
      this.rotationKeyGenerator.generateRotationAngleOverrideKey(
        motion,
        pictographData
      );
    return this.specialPlacement.hasRotationAngleOverride(
      motion,
      pictographData,
      rotationKey
    );
  }

  clearAllOverrides(): void {
    clearRotationOverrides();
  }

  exportOverrides(): string {
    const overrides = this.loadOverrides();
    return JSON.stringify(overrides, null, 2);
  }

  importOverrides(jsonData: string): void {
    try {
      const overrides = canonicalRotationOverrideData(
        JSON.parse(jsonData) as RotationOverrideData
      );
      this.saveOverrides(overrides);
    } catch (error) {
      console.error("Failed to import overrides:", error);
      throw new Error("Invalid override data format");
    }
  }

  private loadOverrides(): RotationOverrideData {
    return loadRotationOverrides();
  }

  private saveOverrides(overrides: RotationOverrideData): void {
    try {
      saveRotationOverrides(overrides);
    } catch (error) {
      console.error("Failed to save rotation overrides:", error);
    }
  }

  private getPlacementFrame(
    pictographData: PictographData
  ): "canonical" | "skewed" {
    if (pictographData.motions.left && pictographData.motions.right) {
      return placementFrameForGridMode(
        _deriveGridMode(pictographData.motions.left, pictographData.motions.right)
      );
    }
    return PlacementFrame.CANONICAL;
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of rotationOverrideManager to avoid DI container rebuilds.
// Dependencies are imported from their direct exports.
// ============================================================================

import { turnsTupleGenerator } from "./turns-tuple-generator";
import { rotationAngleOverrideKeyGenerator } from "../../key-generation/services/rotation-angle-override-key-generator";

// HMR-aware singleton instance (persists localStorage state across HMR)
let hmrRotationOverrideManager: RotationOverrideManager | null =
  import.meta.hot?.data?.rotationOverrideManagerInstance ?? null;

// This dependency was added after older HMR instances were already in memory.
// Recreate those instances so the first toggle after this update does not call
// through an object that cannot resolve the effective authored state.
if (
  hmrRotationOverrideManager &&
  !("specialPlacement" in hmrRotationOverrideManager)
) {
  hmrRotationOverrideManager = null;
}

if (import.meta.hot) {
  import.meta.hot.dispose((data) => {
    data.rotationOverrideManagerInstance = hmrRotationOverrideManager;
  });
}

function getRotationOverrideManager(): RotationOverrideManager {
  if (!hmrRotationOverrideManager) {
    hmrRotationOverrideManager = new RotationOverrideManager(
      turnsTupleGenerator,
      rotationAngleOverrideKeyGenerator,
      specialPlacer
    );
  }
  return hmrRotationOverrideManager;
}

export const rotationOverrideManager = getRotationOverrideManager();
