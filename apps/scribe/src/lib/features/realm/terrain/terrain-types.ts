/**
 * Terrain Types
 *
 * Type definitions for heightmap-based terrain rendering.
 */

export interface TerrainConfig {
  /** Width of the terrain in world units */
  width: number;
  /** Depth of the terrain in world units */
  depth: number;
  /** Maximum height in world units */
  maxHeight: number;
  /** Number of segments along width */
  widthSegments: number;
  /** Number of segments along depth */
  depthSegments: number;
}

export interface GeoCoordinates {
  /** Latitude in decimal degrees */
  lat: number;
  /** Longitude in decimal degrees */
  lng: number;
}

export interface GeoBounds {
  /** Northwest corner */
  nw: GeoCoordinates;
  /** Southeast corner */
  se: GeoCoordinates;
}

export interface MapboxTileCoords {
  x: number;
  y: number;
  z: number;
}

export interface HeightmapData {
  /** Raw height values in meters (row-major order) */
  heights: Float32Array;
  /** Width in pixels/samples */
  width: number;
  /** Height in pixels/samples */
  height: number;
  /** Minimum elevation in meters */
  minElevation: number;
  /** Maximum elevation in meters */
  maxElevation: number;
}

export interface TerrainLocation {
  /** Human-readable name */
  name: string;
  /** Center coordinates */
  center: GeoCoordinates;
  /** Zoom level for fetching (higher = more detail) */
  zoom: number;
  /** Bounds of the area to load */
  bounds: GeoBounds;
  /** Description */
  description?: string;
}

/**
 * Predefined locations for terrain loading.
 * These are real-world locations that can be loaded as terrain.
 */
export const TERRAIN_LOCATIONS: Record<string, TerrainLocation> = {
  hannons_camp: {
    name: "Hannon's Camp America",
    // Actual GPS: 39.5896, -84.7858 (8501 Camden College Corner Rd)
    // Property is 27 acres (~330m x 330m)
    center: { lat: 39.5896, lng: -84.7858 },
    zoom: 17,
    bounds: {
      // Tight bounds around the 27-acre property with small buffer
      // ~400m x 400m area
      nw: { lat: 39.5915, lng: -84.7885 },
      se: { lat: 39.5875, lng: -84.7830 },
    },
    description: "Home of Kinetic Fire - flow arts festival in College Corner, OH",
  },
};
