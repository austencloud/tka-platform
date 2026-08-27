/**
 * Global Arrow Adjustment State
 *
 * In-memory cache of global arrow adjustments using Svelte 5 runes.
 * Provides reactive access to adjustments for the rendering pipeline.
 */

import {
  generateAdjustmentKeyString,
  type GlobalAdjustmentKey,
  type GlobalArrowAdjustment,
} from "../domain/global-arrow-adjustment";
import type { CascadingLookupResult } from "../services/types";

/**
 * Create the global arrow adjustment state
 */
export function createGlobalArrowAdjustmentState() {
  // In-memory cache: key string → adjustment
  let adjustmentsMap = $state<Map<string, GlobalArrowAdjustment>>(new Map());

  /**
   * Internal helper: look up an adjustment by key and return a Point.
   * Used by both getAdjustment (public) and getAdjustmentCascading (public).
   */
  function _getAdjustment(
    key: GlobalAdjustmentKey
  ): { x: number; y: number } | null {
    const keyString = generateAdjustmentKeyString(key);
    const adjustment = adjustmentsMap.get(keyString);
    if (!adjustment) {
      return null;
    }
    return { x: adjustment.adjustmentX, y: adjustment.adjustmentY };
  }

  // Loading state
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    /**
     * Check if state is initialized
     */
    get isInitialized() {
      return isInitialized;
    },

    /**
     * Check if currently loading
     */
    get isLoading() {
      return isLoading;
    },

    /**
     * Get last error message
     */
    get lastError() {
      return lastError;
    },

    /**
     * Get total number of adjustments
     */
    get count() {
      return adjustmentsMap.size;
    },

    /**
     * Get adjustment by key components
     * Returns Point if found, null otherwise
     */
    getAdjustment(key: GlobalAdjustmentKey): { x: number; y: number } | null {
      return _getAdjustment(key);
    },

    getAdjustmentByKey(keyString: string): { x: number; y: number } | null {
      const adjustment = adjustmentsMap.get(keyString);
      if (!adjustment) {
        return null;
      }
      return { x: adjustment.adjustmentX, y: adjustment.adjustmentY };
    },

    getFullAdjustment(key: GlobalAdjustmentKey): GlobalArrowAdjustment | null {
      const keyString = generateAdjustmentKeyString(key);
      return adjustmentsMap.get(keyString) ?? null;
    },

    /**
     * Cascading lookup: Layer 3 → Layer 2 → Layer 1, with orientation fallback.
     *
     * Within each prop-type layer, tries the specific oriKey first (e.g., "counter_counter"),
     * then falls back to the legacy bucket oriKey (e.g., "from_layer2"). This lets new
     * orientation-specific adjustments take priority while old bucket-based entries serve
     * as the general fallback.
     *
     * Non-staff props never fall back to Layer 1. This prevents staff adjustments
     * from bleeding into other prop types when switching props.
     */
    getAdjustmentCascading(
      baseKey: GlobalAdjustmentKey,
      thisPropType: string,
      otherPropType: string,
      legacyOriKey?: string
    ): CascadingLookupResult | null {
      const normalizedThisProp = thisPropType.toLowerCase();
      const normalizedOtherProp = otherPropType.toLowerCase();

      // Build the legacy fallback key (only if a legacy oriKey was provided and differs)
      const fallbackKey =
        legacyOriKey && legacyOriKey !== baseKey.oriKey
          ? { ...baseKey, oriKey: legacyOriKey }
          : null;

      // Layer 3: Combination-specific (this prop + other prop)
      if (normalizedThisProp !== "staff" || normalizedOtherProp !== "staff") {
        const layer3Key: GlobalAdjustmentKey = {
          ...baseKey,
          propType: normalizedThisProp,
          otherPropType: normalizedOtherProp,
        };
        const layer3 = _getAdjustment(layer3Key);
        if (layer3) return { adjustment: layer3, layer: 3 };

        // Fallback: try legacy oriKey at Layer 3
        if (fallbackKey) {
          const layer3Fallback: GlobalAdjustmentKey = {
            ...fallbackKey,
            propType: normalizedThisProp,
            otherPropType: normalizedOtherProp,
          };
          const layer3fb = _getAdjustment(layer3Fallback);
          if (layer3fb) return { adjustment: layer3fb, layer: 3 };
        }
      }

      // Layer 2: Prop-specific (just this prop type)
      const layer2Key: GlobalAdjustmentKey = {
        ...baseKey,
        propType: normalizedThisProp,
      };
      const layer2 = _getAdjustment(layer2Key);
      if (layer2) return { adjustment: layer2, layer: 2 };

      // Fallback: try legacy oriKey at Layer 2
      if (fallbackKey) {
        const layer2Fallback: GlobalAdjustmentKey = {
          ...fallbackKey,
          propType: normalizedThisProp,
        };
        const layer2fb = _getAdjustment(layer2Fallback);
        if (layer2fb) return { adjustment: layer2fb, layer: 2 };
      }

      // Layer 1: Base (no prop types) - legacy fallback for staff ONLY.
      if (normalizedThisProp === "staff" && normalizedOtherProp === "staff") {
        const layer1 = _getAdjustment(baseKey);
        if (layer1) return { adjustment: layer1, layer: 1 };

        // Fallback: try legacy oriKey at Layer 1
        if (fallbackKey) {
          const layer1fb = _getAdjustment(fallbackKey);
          if (layer1fb) return { adjustment: layer1fb, layer: 1 };
        }
      }

      return null;
    },

    /**
     * Check if an adjustment exists for the given key
     */
    hasAdjustment(key: GlobalAdjustmentKey): boolean {
      const keyString = generateAdjustmentKeyString(key);
      return adjustmentsMap.has(keyString);
    },

    /**
     * Set an adjustment in the cache
     * Called by persister after Firestore write or on initial load
     */
    setAdjustment(adjustment: GlobalArrowAdjustment): void {
      // Build key including optional propType and otherPropType for Layer 2/3 support
      const key: GlobalAdjustmentKey = {
        placementFrame: adjustment.placementFrame,
        oriKey: adjustment.oriKey,
        letter: adjustment.letter,
        turnsTuple: adjustment.turnsTuple,
        arrowKey: adjustment.arrowKey,
        ...(adjustment.propType && { propType: adjustment.propType }),
        ...(adjustment.otherPropType && {
          otherPropType: adjustment.otherPropType,
        }),
      };
      const keyString = generateAdjustmentKeyString(key);
      // Create new map to trigger reactivity
      const newMap = new Map(adjustmentsMap);
      newMap.set(keyString, adjustment);
      adjustmentsMap = newMap;
    },

    removeAdjustment(key: GlobalAdjustmentKey): void {
      const keyString = generateAdjustmentKeyString(key);
      if (adjustmentsMap.has(keyString)) {
        const newMap = new Map(adjustmentsMap);
        newMap.delete(keyString);
        adjustmentsMap = newMap;
      }
    },

    /**
     * Load all adjustments (called by persister)
     */
    loadAll(adjustments: GlobalArrowAdjustment[]): void {
      isLoading = true;
      lastError = null;

      try {
        const newMap = new Map<string, GlobalArrowAdjustment>();
        for (const adjustment of adjustments) {
          // Build key including optional propType and otherPropType for Layer 2/3 support
          const key: GlobalAdjustmentKey = {
            placementFrame: adjustment.placementFrame,
            oriKey: adjustment.oriKey,
            letter: adjustment.letter,
            turnsTuple: adjustment.turnsTuple,
            arrowKey: adjustment.arrowKey,
            ...(adjustment.propType && { propType: adjustment.propType }),
            ...(adjustment.otherPropType && {
              otherPropType: adjustment.otherPropType,
            }),
          };
          const keyString = generateAdjustmentKeyString(key);
          newMap.set(keyString, adjustment);
        }
        adjustmentsMap = newMap;
        isInitialized = true;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Failed to load adjustments";
        console.error("[GlobalArrowAdjustmentState] Load error:", error);
      } finally {
        isLoading = false;
      }
    },

    /**
     * Clear all adjustments
     */
    clear(): void {
      adjustmentsMap = new Map();
      isInitialized = false;
    },

    /**
     * Get all adjustments as array (for debugging/export)
     */
    getAllAdjustments(): GlobalArrowAdjustment[] {
      return Array.from(adjustmentsMap.values());
    },

    /**
     * Set loading state (called by persister)
     */
    setLoading(loading: boolean): void {
      isLoading = loading;
    },

    /**
     * Set error state (called by persister)
     */
    setError(error: string | null): void {
      lastError = error;
    },
  };
}

/**
 * Type for the state object
 */
export type GlobalArrowAdjustmentState = ReturnType<
  typeof createGlobalArrowAdjustmentState
>;
