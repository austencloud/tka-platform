import { Point } from "fabric";
import type { SpecialArrowPlacement } from "../domain/SpecialArrowPlacement";

export function createSpecialArrowPlacementState() {
  let overridesMap = $state<Map<string, SpecialArrowPlacement>>(new Map());
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    get isInitialized() { return isInitialized; },
    get isLoading() { return isLoading; },
    get lastError() { return lastError; },
    get count() { return overridesMap.size; },

    getOverride(key: string): Point | null {
      const entry = overridesMap.get(key);
      if (!entry) return null;
      return new Point(entry.adjustmentX, entry.adjustmentY);
    },

    getFullOverride(key: string): SpecialArrowPlacement | null {
      return overridesMap.get(key) ?? null;
    },

    hasOverride(key: string): boolean {
      return overridesMap.has(key);
    },

    setOverride(override: SpecialArrowPlacement): void {
      const newMap = new Map(overridesMap);
      newMap.set(override.key, override);
      overridesMap = newMap;
    },

    removeOverride(key: string): void {
      if (overridesMap.has(key)) {
        const newMap = new Map(overridesMap);
        newMap.delete(key);
        overridesMap = newMap;
      }
    },

    loadAll(overrides: SpecialArrowPlacement[]): void {
      isLoading = true;
      lastError = null;
      try {
        const newMap = new Map<string, SpecialArrowPlacement>();
        for (const override of overrides) {
          newMap.set(override.key, override);
        }
        overridesMap = newMap;
        isInitialized = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to load overrides";
      } finally {
        isLoading = false;
      }
    },

    clear(): void {
      overridesMap = new Map();
      isInitialized = false;
    },

    setLoading(loading: boolean): void { isLoading = loading; },
    setError(error: string | null): void { lastError = error; },
  };
}

export type SpecialArrowPlacementState = ReturnType<typeof createSpecialArrowPlacementState>;
