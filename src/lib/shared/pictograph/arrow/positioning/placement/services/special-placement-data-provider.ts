/**
 * Special Placement Data Provider
 *
 * Handles loading and caching of special placement JSON data.
 * Uses Promise-based caching to prevent race conditions during concurrent loads.
 */

import { jsonCache } from "$lib/shared/pictograph/shared/services/simple-json-cache";
import type { SimpleJsonCache } from '$lib/shared/pictograph/shared/services/simple-json-cache'

export class SpecialPlacementDataProvider {
  // Structure: [gridMode][oriKey][letter] -> Record<string, unknown>
  private cache: Record<
    string,
    Record<string, Record<string, Record<string, unknown>>>
  > = {
    diamond: {},
    box: {},
  };

  // Track in-flight loading operations to prevent race conditions
  private loadingPromises = new Map<string, Promise<void>>();

  // Manifest of which files actually exist (loaded lazily), keyed by gridMode
  private manifests = new Map<string, Record<string, string[]>>();
  private manifestLoadPromises = new Map<string, Promise<void>>();

  /**
   * Create SpecialPlacementDataProvider with injectable JSON cache
   * @param jsonCache JSON cache implementation (defaults to browser fetch-based cache)
   */
  constructor(private readonly jsonCacheImpl: SimpleJsonCache = jsonCache) {}

  /**
   * Load the manifest file that tells us which placement files exist
   */
  private async loadManifest(gridMode: string): Promise<void> {
    // Return if already loaded for this gridMode
    if (this.manifests.has(gridMode)) return;

    // Check if loading is already in progress for this gridMode
    if (this.manifestLoadPromises.has(gridMode)) {
      await this.manifestLoadPromises.get(gridMode);
      return;
    }

    // Start loading
    const loadPromise = (async () => {
      try {
        const manifestPath = `/data/arrow_placement/${gridMode}/special/placement_manifest.json`;
        const manifest = (await this.jsonCacheImpl.get(manifestPath)) as Record<
          string,
          string[]
        >;
        this.manifests.set(gridMode, manifest);
      } catch {
        // If manifest doesn't exist, cache empty object (no special placements for this gridMode)
        this.manifests.set(gridMode, {});
      } finally {
        // Clean up loading promise
        this.manifestLoadPromises.delete(gridMode);
      }
    })();

    this.manifestLoadPromises.set(gridMode, loadPromise);
    await loadPromise;
  }

  /**
   * Check if a placement file exists for the given letter
   */
  private async hasPlacementFile(
    gridMode: string,
    oriKey: string,
    letter: string
  ): Promise<boolean> {
    await this.loadManifest(gridMode);
    const manifest = this.manifests.get(gridMode);
    return manifest?.[oriKey]?.includes(letter) ?? false;
  }

  /**
   * Get special placement data for a specific letter.
   * Returns cached data if available, otherwise loads from JSON.
   */
  async getLetterData(
    gridMode: string,
    oriKey: string,
    letter: string
  ): Promise<Record<string, unknown>> {
    try {
      // Ensure cache structure exists
      this.ensureCacheStructure(gridMode, oriKey);

      // Return cached data if available
      if (this.cache[gridMode]?.[oriKey]?.[letter]) {
        return this.cache[gridMode][oriKey][letter];
      }

      // Check manifest to see if file exists before attempting to fetch
      const fileExists = await this.hasPlacementFile(gridMode, oriKey, letter);
      if (!fileExists) {
        // No placement file exists - cache and return empty object immediately
        if (this.cache[gridMode]?.[oriKey]) {
          this.cache[gridMode][oriKey][letter] = {};
        }
        return {};
      }

      const cacheKey = `${gridMode}:${oriKey}:${letter}`;

      // Check if loading is already in progress
      if (this.loadingPromises.has(cacheKey)) {
        await this.loadingPromises.get(cacheKey);
        return this.cache[gridMode]?.[oriKey]?.[letter] || {};
      }

      // Start new loading operation
      const loadingPromise = this.loadData(gridMode, oriKey, letter);
      this.loadingPromises.set(cacheKey, loadingPromise);

      try {
        await loadingPromise;
        return this.cache[gridMode]?.[oriKey]?.[letter] || {};
      } finally {
        // Clean up the promise from cache when done
        this.loadingPromises.delete(cacheKey);
      }
    } catch {
      // Missing special placement files are expected - return empty object (interpreted as zero adjustment)
      return {};
    }
  }

  /**
   * Ensure cache structure exists for gridMode and oriKey
   */
  private ensureCacheStructure(gridMode: string, oriKey: string): void {
    if (!this.cache[gridMode]) {
      this.cache[gridMode] = {} as Record<
        string,
        Record<string, Record<string, unknown>>
      >;
    }
    if (!this.cache[gridMode][oriKey]) {
      this.cache[gridMode][oriKey] = {} as Record<
        string,
        Record<string, unknown>
      >;
    }
  }

  /**
   * Load data from JSON file and store in cache
   */
  private async loadData(
    gridMode: string,
    oriKey: string,
    letter: string
  ): Promise<void> {
    // Files are served under /data/... in the web app
    // Example path: /data/arrow_placement/diamond/special/from_layer1/A_placements.json
    const encodedLetter = encodeURIComponent(letter);
    const basePath = `/data/arrow_placement/${gridMode}/special/${oriKey}/${encodedLetter}_placements.json`;

    try {
      const data = (await this.jsonCacheImpl.get(basePath)) as Record<string, unknown>;
      if (this.cache[gridMode]?.[oriKey]) {
        this.cache[gridMode][oriKey][letter] = data;
      }
    } catch {
      // If file doesn't exist, store empty object
      if (this.cache[gridMode]?.[oriKey]) {
        this.cache[gridMode][oriKey][letter] = {};
      }
    }
  }
}

// ============================================================================
// DIRECT SINGLETON EXPORT
// ============================================================================
// Use this instead of specialPlacementDataProvider to avoid DI container rebuilds.
// ============================================================================

export const specialPlacementDataProvider = new SpecialPlacementDataProvider();
