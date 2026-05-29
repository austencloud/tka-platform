/**
 * Arrow Placement Data Service
 *
 * Loads and manages arrow placement JSON data for positioning calculations.
 * Ports the exact functionality from desktop DefaultPlacer.
 */

import type { MotionType } from "../../../../shared/domain/enums/pictograph-enums";
import { GridMode } from "../../../../grid/domain/enums/grid-enums";
import { jsonCache } from "$lib/shared/pictograph/shared/services/simple-json-cache";
import type { SimpleJsonCache } from '$lib/shared/pictograph/shared/services/simple-json-cache'
import type {
  AllPlacementData,
  JsonPlacementData,
} from "../domain/models/PlacementDataTypes";
import { createComponentLogger } from "$lib/shared/utils/debug-logger";

const debug = createComponentLogger("ArrowPlacer");

export class ArrowPlacer {
  private jsonCacheImpl: SimpleJsonCache;
  private allPlacements: AllPlacementData = {
    [GridMode.DIAMOND]: {},
    [GridMode.BOX]: {},
    [GridMode.SKEWED]: {}, // Uses diamond placements as base
  };

  // Track which grid modes have been loaded (lazy loading by grid mode)
  private loadedGridModes = new Set<GridMode>();

  // File mapping for placement data
  private readonly placementFiles: Record<string, Record<string, string>> = {
    [GridMode.DIAMOND]: {
      pro: "/data/arrow_placement/diamond/default/default_diamond_pro_placements.json",
      anti: "/data/arrow_placement/diamond/default/default_diamond_anti_placements.json",
      float:
        "/data/arrow_placement/diamond/default/default_diamond_float_placements.json",
      dash: "/data/arrow_placement/diamond/default/default_diamond_dash_placements.json",
      static:
        "/data/arrow_placement/diamond/default/default_diamond_static_placements.json",
    },
    [GridMode.BOX]: {
      pro: "/data/arrow_placement/box/default/default_box_pro_placements.json",
      anti: "/data/arrow_placement/box/default/default_box_anti_placements.json",
      float:
        "/data/arrow_placement/box/default/default_box_float_placements.json",
      dash: "/data/arrow_placement/box/default/default_box_dash_placements.json",
      static:
        "/data/arrow_placement/box/default/default_box_static_placements.json",
    },
    // SKEWED mode doesn't have separate files - it uses both diamond and box
  };

  /**
   * Create ArrowPlacer with optional injectable JSON cache
   * @param jsonCacheImpl JSON cache implementation (defaults to browser fetch-based cache)
   */
  constructor(jsonCacheImpl?: SimpleJsonCache) {
    this.jsonCacheImpl = jsonCacheImpl ?? jsonCache;
  }

  /**
   * Load all placement data from JSON files
   * @deprecated Use ensureGridModeLoaded() for lazy loading by grid mode
   */
  async loadPlacementData(): Promise<void> {
    // Load both grid modes for backwards compatibility
    await this.ensureGridModeLoaded(GridMode.DIAMOND);
    await this.ensureGridModeLoaded(GridMode.BOX);
  }

  /**
   * Ensure placement data is loaded for a specific grid mode (lazy loading)
   * Only loads 5 files for the requested grid mode instead of all 10
   * SKEWED mode loads BOTH diamond and box placements (arrows can be at either)
   */
  async ensureGridModeLoaded(gridMode: GridMode): Promise<void> {
    // For SKEWED mode, we need BOTH diamond and box placements
    // because arrows can end at cardinal (diamond) OR intercardinal (box) positions
    if (gridMode === GridMode.SKEWED) {
      await this.ensureGridModeLoaded(GridMode.DIAMOND);
      await this.ensureGridModeLoaded(GridMode.BOX);
      this.loadedGridModes.add(GridMode.SKEWED);
      return;
    }

    // Skip if already loaded
    if (this.loadedGridModes.has(gridMode)) {
      return;
    }

    // Log when we're loading a new grid mode (helps trace startup issues)
    // Include stack trace to help identify what triggered the load
    debug.log(
      `Loading ${gridMode} mode placement data (lazy load triggered)`
    );
    if (gridMode === GridMode.BOX) {
      debug.log(`BOX mode placement load triggered from:`, new Error().stack);
    }

    try {
      await this.loadGridPlacements(gridMode);
      this.loadedGridModes.add(gridMode);
    } catch (error) {
      console.error(
        `❌ Failed to load ${gridMode} placement data:`,
        error
      );
      throw new Error(
        `Placement data loading failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Load placements for a specific grid mode
   */
  private async loadGridPlacements(gridMode: GridMode): Promise<void> {
    // SKEWED mode should never reach here - it's handled by ensureGridModeLoaded
    // which loads both DIAMOND and BOX modes instead
    if (gridMode === GridMode.SKEWED) {
      console.warn("loadGridPlacements called with SKEWED - should use ensureGridModeLoaded");
      return;
    }
    const files = this.placementFiles[gridMode];
    this.allPlacements[gridMode] = {};

    for (const [motionType, filePath] of Object.entries(files ?? {})) {
      try {
        const placementData = await this.loadJsonFile(filePath);
        // Filter out null values to match GridPlacementData type
        const filteredData: {
          [placementKey: string]: { [turns: string]: [number, number] };
        } = {};
        for (const [placementKey, turnsData] of Object.entries(
          placementData ?? {}
        )) {
          filteredData[placementKey] = {};
          for (const [turns, coords] of Object.entries(turnsData ?? {})) {
            if (
              coords !== null &&
              Array.isArray(coords) &&
              coords.length === 2 &&
              typeof coords[0] === "number" &&
              typeof coords[1] === "number"
            ) {
              filteredData[placementKey][turns] = coords as unknown as [
                number,
                number,
              ];
            }
          }
        }
        this.allPlacements[gridMode][motionType] = filteredData;
      } catch (error) {
        console.warn(
          `Could not load ${motionType} placements for ${gridMode}: ${error}`
        );
        this.allPlacements[gridMode][motionType] = {};
      }
    }
  }

  /**
   * Load JSON file with caching
   */
  private async loadJsonFile(path: string): Promise<JsonPlacementData> {
    try {
      const data = await this.jsonCacheImpl.get(path);
      return data as JsonPlacementData;
    } catch (error) {
      console.warn(`Failed to load placement data from ${path}:`, error);
      return {};
    }
  }

  /**
   * Get default adjustment using placement key and turns
   */
  async getDefaultAdjustment(
    motionType: MotionType,
    placementKey: string,
    turns: number | string,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<{ x: number; y: number }> {
    await this.ensureDataLoaded(gridMode);

    const gridPlacements = this.allPlacements[gridMode];
    if (!gridPlacements) {
      return { x: 0, y: 0 };
    }

    const motionPlacements = gridPlacements[motionType];
    if (!motionPlacements) {
      return { x: 0, y: 0 };
    }

    const placementData = motionPlacements[placementKey];
    if (!placementData) {
      return { x: 0, y: 0 };
    }

    // Convert turns to string format used in JSON
    const turnsStr = this.formatTurnsForLookup(turns);
    const adjustment = placementData[turnsStr];

    if (!adjustment) {
      return { x: 0, y: 0 };
    }

    const [x, y] = adjustment;
    return { x, y };
  }

  /**
   * Get available placement keys for a motion type
   */
  async getAvailablePlacementKeys(
    motionType: MotionType,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<string[]> {
    await this.ensureDataLoaded(gridMode);

    const motionPlacements = this.allPlacements[gridMode]?.[motionType];
    if (!motionPlacements) {
      return [];
    }

    return Object.keys(motionPlacements);
  }

  /**
   * Check if data is loaded for a grid mode (or any grid mode if not specified)
   */
  isLoaded(gridMode?: GridMode): boolean {
    if (gridMode) {
      // SKEWED mode requires both DIAMOND and BOX to be loaded
      if (gridMode === GridMode.SKEWED) {
        return this.loadedGridModes.has(GridMode.DIAMOND) &&
               this.loadedGridModes.has(GridMode.BOX);
      }
      return this.loadedGridModes.has(gridMode);
    }
    // For backwards compatibility, check if at least diamond is loaded
    return this.loadedGridModes.has(GridMode.DIAMOND);
  }

  /**
   * Ensure data is loaded for a specific grid mode (lazy loading)
   */
  private async ensureDataLoaded(
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<void> {
    await this.ensureGridModeLoaded(gridMode);
  }

  /**
   * Format turns value for JSON lookup
   * Converts: 1.0 → "1", 0.5 → "0.5", etc.
   */
  private formatTurnsForLookup(turns: number | string): string {
    if (typeof turns === "string") {
      return turns; // Already formatted (e.g., "fl" for float)
    }

    // Convert numbers: remove .0 for whole numbers
    if (turns === Math.floor(turns)) {
      return Math.floor(turns).toString();
    }

    return turns.toString();
  }

  /**
   * Debug method to log available keys
   */
  async debugAvailableKeys(
    motionType: MotionType,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<string[]> {
    const keys = await this.getAvailablePlacementKeys(motionType, gridMode);
    return keys;
  }

  /**
   * Get raw placement data for debugging
   */
  async getPlacementData(
    motionType: MotionType,
    placementKey: string,
    gridMode: GridMode = GridMode.DIAMOND
  ): Promise<{ [turns: string]: [number, number] }> {
    await this.ensureDataLoaded(gridMode);

    const motionPlacements = this.allPlacements[gridMode]?.[motionType];
    return motionPlacements?.[placementKey] || {};
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of arrowPlacer to avoid DI container rebuilds.
// Uses the default jsonCache singleton.
// ============================================================================

export const arrowPlacer = new ArrowPlacer();
