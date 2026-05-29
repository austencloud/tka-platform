/**
 * Tempo Region Manager
 *
 * Manages dynamic BPM tempo regions for variable-tempo audio tracks.
 * Extracted from composition-state.svelte.ts for single responsibility.
 */

import type { TempoRegion } from "../composition-types";

export type TempoRegionManager = ReturnType<typeof createTempoRegionManager>;

export function createTempoRegionManager() {
  let regions = $state<TempoRegion[]>([]);

  // =========================================================================
  // CRUD Operations
  // =========================================================================

  function add(region: TempoRegion) {
    // Insert in sorted order by startTime
    regions = [...regions, region].sort((a, b) => a.startTime - b.startTime);
  }

  function remove(regionId: string) {
    regions = regions.filter((r) => r.id !== regionId);
  }

  function update(regionId: string, updates: Partial<TempoRegion>) {
    regions = regions
      .map((r) => (r.id === regionId ? { ...r, ...updates } : r))
      .sort((a, b) => a.startTime - b.startTime);
  }

  function setAll(newRegions: TempoRegion[]) {
    regions = [...newRegions].sort((a, b) => a.startTime - b.startTime);
  }

  function clear() {
    regions = [];
  }

  // =========================================================================
  // Queries
  // =========================================================================

  /**
   * Get the BPM at a specific time in the audio.
   * Returns the tempo region's BPM if within a region, otherwise returns null.
   */
  function getBpmAtTime(time: number): number | null {
    for (const region of regions) {
      if (time >= region.startTime && time < region.endTime) {
        return region.bpm;
      }
    }
    return null;
  }

  // =========================================================================
  // Return API
  // =========================================================================

  return {
    // State getter
    get regions() {
      return regions;
    },

    // CRUD
    add,
    remove,
    update,
    setAll,
    clear,

    // Queries
    getBpmAtTime,
  };
}
