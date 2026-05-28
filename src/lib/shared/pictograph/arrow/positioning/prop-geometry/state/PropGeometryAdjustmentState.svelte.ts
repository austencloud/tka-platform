/**
 * Prop Geometry Adjustment State
 *
 * In-memory cache of prop geometry adjustments using Svelte 5 runes.
 * Mirrors the pattern of GlobalArrowAdjustmentState but for the
 * letter-free prop geometry tier.
 */

import { Point } from "fabric";
import {
  generatePropGeometryKeyString,
  generateCascadingKeys,
  type PropGeometryAdjustment,
  type PropGeometryKey,
} from "../domain/PropGeometryAdjustment";
import type { CascadingPropGeometryResult } from "../services/contracts/types";

export function createPropGeometryAdjustmentState() {
  let adjustmentsMap = $state<Map<string, PropGeometryAdjustment>>(new Map());
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    get isInitialized() {
      return isInitialized;
    },

    get isLoading() {
      return isLoading;
    },

    get lastError() {
      return lastError;
    },

    get count() {
      return adjustmentsMap.size;
    },

    /**
     * Cascading lookup: full key → wildcard arrowColor → wildcard otherPropType → wildcard both
     */
    getAdjustmentCascading(
      key: PropGeometryKey
    ): CascadingPropGeometryResult | null {
      const cascadingKeys = generateCascadingKeys(key);

      for (const candidateKey of cascadingKeys) {
        const adjustment = adjustmentsMap.get(candidateKey);
        if (adjustment) {
          return {
            adjustment: new Point(adjustment.adjustmentX, adjustment.adjustmentY),
            matchedKey: candidateKey,
          };
        }
      }

      return null;
    },

    /** Exact (non-cascading) lookup by full key. */
    getAdjustment(key: PropGeometryKey): { x: number; y: number } | null {
      const keyString = generatePropGeometryKeyString(key);
      const adjustment = adjustmentsMap.get(keyString);
      return adjustment
        ? { x: adjustment.adjustmentX, y: adjustment.adjustmentY }
        : null;
    },

    hasAdjustment(key: PropGeometryKey): boolean {
      return adjustmentsMap.has(generatePropGeometryKeyString(key));
    },

    setAdjustment(adjustment: PropGeometryAdjustment): void {
      const keyString = generatePropGeometryKeyString({
        gridMode: adjustment.gridMode,
        propType: adjustment.propType,
        otherPropType: adjustment.otherPropType,
        positionType: adjustment.positionType,
        endOrientation: adjustment.endOrientation,
        otherEndOrientation: adjustment.otherEndOrientation,
        motionType: adjustment.motionType,
        turns: adjustment.turns,
        arrowColor: adjustment.arrowColor,
      });
      const newMap = new Map(adjustmentsMap);
      newMap.set(keyString, adjustment);
      adjustmentsMap = newMap;
    },

    removeAdjustment(key: PropGeometryKey): void {
      const keyString = generatePropGeometryKeyString(key);
      if (adjustmentsMap.has(keyString)) {
        const newMap = new Map(adjustmentsMap);
        newMap.delete(keyString);
        adjustmentsMap = newMap;
      }
    },

    loadAll(adjustments: PropGeometryAdjustment[]): void {
      isLoading = true;
      lastError = null;

      try {
        const newMap = new Map<string, PropGeometryAdjustment>();
        for (const adjustment of adjustments) {
          const keyString = generatePropGeometryKeyString({
            gridMode: adjustment.gridMode,
            propType: adjustment.propType,
            otherPropType: adjustment.otherPropType,
            positionType: adjustment.positionType,
            endOrientation: adjustment.endOrientation,
            otherEndOrientation: adjustment.otherEndOrientation,
            motionType: adjustment.motionType,
            turns: adjustment.turns,
            arrowColor: adjustment.arrowColor,
          });
          newMap.set(keyString, adjustment);
        }
        adjustmentsMap = newMap;
        isInitialized = true;
      } catch (error) {
        lastError =
          error instanceof Error ? error.message : "Failed to load adjustments";
        console.error("[PropGeometryAdjustmentState] Load error:", error);
      } finally {
        isLoading = false;
      }
    },

    clear(): void {
      adjustmentsMap = new Map();
      isInitialized = false;
    },

    setLoading(loading: boolean): void {
      isLoading = loading;
    },

    setError(error: string | null): void {
      lastError = error;
    },
  };
}

export type PropGeometryAdjustmentState = ReturnType<
  typeof createPropGeometryAdjustmentState
>;
