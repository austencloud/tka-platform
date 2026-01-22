/**
 * ITerrainLoader
 *
 * Contract for loading terrain heightmap data from various sources.
 */

import type { GeoCoordinates, GeoBounds, HeightmapData } from "./terrain-types";

export interface ITerrainLoader {
  /**
   * Load heightmap data for a geographic region.
   * @param bounds - Geographic bounds to load
   * @param resolution - Desired resolution (width x height samples)
   * @returns Heightmap data with elevation values
   */
  loadHeightmap(
    bounds: GeoBounds,
    resolution: { width: number; height: number }
  ): Promise<HeightmapData>;

  /**
   * Get elevation at a specific point.
   * @param coord - Geographic coordinates
   * @returns Elevation in meters, or null if unavailable
   */
  getElevationAt(coord: GeoCoordinates): Promise<number | null>;

  /**
   * Check if the loader is ready (has valid API key, etc.)
   */
  isReady(): boolean;
}
