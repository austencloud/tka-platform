/**
 * Global Arrow Adjustment State
 *
 * In-memory cache of global arrow adjustments using Svelte 5 runes.
 * Provides reactive access to adjustments for the rendering pipeline.
 */

import { Point } from "fabric";
import {
  generateAdjustmentKeyString,
  type GlobalAdjustmentKey,
  type GlobalArrowAdjustment,
} from "../domain/GlobalArrowAdjustment";

/**
 * Create the global arrow adjustment state
 */
export function createGlobalArrowAdjustmentState() {
  // In-memory cache: key string → adjustment
  let adjustmentsMap = $state<Map<string, GlobalArrowAdjustment>>(new Map());

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
    getAdjustment(key: GlobalAdjustmentKey): Point | null {
      const keyString = generateAdjustmentKeyString(key);
      const adjustment = adjustmentsMap.get(keyString);
      if (!adjustment) {
        return null;
      }
      return new Point(adjustment.adjustmentX, adjustment.adjustmentY);
    },

    /**
     * Get adjustment by string key
     */
    getAdjustmentByKey(keyString: string): Point | null {
      const adjustment = adjustmentsMap.get(keyString);
      if (!adjustment) {
        return null;
      }
      return new Point(adjustment.adjustmentX, adjustment.adjustmentY);
    },

    /**
     * Get full adjustment data by key
     */
    getFullAdjustment(key: GlobalAdjustmentKey): GlobalArrowAdjustment | null {
      const keyString = generateAdjustmentKeyString(key);
      return adjustmentsMap.get(keyString) ?? null;
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
        gridMode: adjustment.gridMode,
        oriKey: adjustment.oriKey,
        letter: adjustment.letter,
        turnsTuple: adjustment.turnsTuple,
        arrowKey: adjustment.arrowKey,
        ...(adjustment.propType && { propType: adjustment.propType }),
        ...(adjustment.otherPropType && { otherPropType: adjustment.otherPropType }),
      };
      const keyString = generateAdjustmentKeyString(key);
      // Create new map to trigger reactivity
      const newMap = new Map(adjustmentsMap);
      newMap.set(keyString, adjustment);
      adjustmentsMap = newMap;
    },

    /**
     * Remove an adjustment from the cache
     */
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
            gridMode: adjustment.gridMode,
            oriKey: adjustment.oriKey,
            letter: adjustment.letter,
            turnsTuple: adjustment.turnsTuple,
            arrowKey: adjustment.arrowKey,
            ...(adjustment.propType && { propType: adjustment.propType }),
            ...(adjustment.otherPropType && { otherPropType: adjustment.otherPropType }),
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
