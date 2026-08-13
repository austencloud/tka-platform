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
const STORAGE_KEY = "tka_rotation_overrides";

interface RotationOverrideData {
  [gridMode: string]: {
    [oriKey: string]: {
      [letter: string]: {
        [turnsTuple: string]: {
          [rotationKey: string]: boolean;
        };
      };
    };
  };
}

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
    const gridMode = this.getGridMode(pictographData);
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
    if (!overrides[gridMode]) overrides[gridMode] = {};
    if (!overrides[gridMode][oriKey]) overrides[gridMode][oriKey] = {};
    if (!overrides[gridMode][oriKey][letter])
      overrides[gridMode][oriKey][letter] = {};
    if (!overrides[gridMode][oriKey][letter][turnsTuple])
      overrides[gridMode][oriKey][letter][turnsTuple] = {};

    const turnsData = overrides[gridMode][oriKey][letter][turnsTuple];

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
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  exportOverrides(): string {
    const overrides = this.loadOverrides();
    return JSON.stringify(overrides, null, 2);
  }

  importOverrides(jsonData: string): void {
    try {
      const overrides = JSON.parse(jsonData) as RotationOverrideData;
      this.saveOverrides(overrides);
    } catch (error) {
      console.error("Failed to import overrides:", error);
      throw new Error("Invalid override data format");
    }
  }

  private loadOverrides(): RotationOverrideData {
    if (typeof localStorage === "undefined") {
      return {};
    }

    try {
      const data = localStorage.getItem(STORAGE_KEY);
      if (!data) return {};
      return JSON.parse(data) as RotationOverrideData;
    } catch (error) {
      console.error("Failed to load rotation overrides:", error);
      return {};
    }
  }

  private saveOverrides(overrides: RotationOverrideData): void {
    if (typeof localStorage === "undefined") {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides));
    } catch (error) {
      console.error("Failed to save rotation overrides:", error);
    }
  }

  private getGridMode(pictographData: PictographData): string {
    if (pictographData.motions.blue && pictographData.motions.red) {
      return _deriveGridMode(
        pictographData.motions.blue,
        pictographData.motions.red
      );
    }
    return "diamond";
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
