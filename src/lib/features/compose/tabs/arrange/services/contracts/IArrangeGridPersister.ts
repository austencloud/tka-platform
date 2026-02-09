/**
 * IArrangeGridPersister - Contract for grid state persistence
 *
 * Handles localStorage read/write for the arrange grid configuration,
 * including migration from older storage formats (v6 -> v7).
 */

import type { GridConfig } from "../../state/arrange-grid-state.svelte";

export interface IArrangeGridPersister {
  /**
   * Load grid configuration from localStorage.
   * Handles v6 -> v7 migration transparently.
   * Returns default config if nothing is stored or on error.
   */
  load(): GridConfig;

  /**
   * Save grid configuration to localStorage.
   */
  save(config: GridConfig): void;

  /**
   * One-time migration: move any compositions saved to localStorage
   * into Dexie so they appear in the Browse tab.
   */
  migrateLocalStorageCompositions(): Promise<void>;
}
