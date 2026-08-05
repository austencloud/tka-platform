import type { SpecialArrowPlacement } from "../domain/special-arrow-placement";

export function createSpecialArrowPlacementState() {
  let overridesMap = $state<Map<string, SpecialArrowPlacement>>(new Map());
  // Raw overrides as received by loadAll, retained so the bundle can round-trip via loadAll(getAllOverrides()).
  let loadedOverrides: SpecialArrowPlacement[] = [];
  let isLoading = $state(false);
  let isInitialized = $state(false);
  let lastError = $state<string | null>(null);

  return {
    get isInitialized() { return isInitialized; },
    get isLoading() { return isLoading; },
    get lastError() { return lastError; },
    get count() { return overridesMap.size; },

    getOverride(key: string): { x: number; y: number } | null {
      const entry = overridesMap.get(key);
      if (!entry) return null;
      if (entry.adjustmentX === 0 && entry.adjustmentY === 0) return null; // zero = absent
      return { x: entry.adjustmentX, y: entry.adjustmentY };
    },

    getFullOverride(key: string): SpecialArrowPlacement | null {
      return overridesMap.get(key) ?? null;
    },

    hasOverride(key: string): boolean {
      const entry = overridesMap.get(key);
      return !!entry && !(entry.adjustmentX === 0 && entry.adjustmentY === 0);
    },

    /**
     * True when a tombstone hides the ENTIRE Special tier for this key —
     * static JSON included. Distinct from "no override": an absent doc means
     * the static JSON still wins, a suppressed doc means it doesn't.
     */
    isSuppressed(key: string): boolean {
      return overridesMap.get(key)?.suppressed === true;
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
        loadedOverrides = [...overrides];
        isInitialized = true;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Failed to load overrides";
      } finally {
        isLoading = false;
      }
    },

    /** Raw loaded overrides (shallow copy) in the exact shape loadAll consumes — for the bundle snapshot. */
    getAllOverrides(): SpecialArrowPlacement[] {
      return [...loadedOverrides];
    },

    clear(): void {
      overridesMap = new Map();
      loadedOverrides = [];
      isInitialized = false;
    },

    setLoading(loading: boolean): void { isLoading = loading; },
    setError(error: string | null): void { lastError = error; },
  };
}

export type SpecialArrowPlacementState = ReturnType<typeof createSpecialArrowPlacementState>;
