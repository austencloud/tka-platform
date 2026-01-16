/**
 * MapboxTerrainLoader
 *
 * Loads terrain elevation data from Mapbox Terrain-RGB tiles.
 * See: https://docs.mapbox.com/data/tilesets/reference/mapbox-terrain-rgb-v1/
 *
 * Elevation is encoded in RGB values:
 *   height = -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1)
 */

import type { ITerrainLoader } from "../contracts/ITerrainLoader";
import type {
  GeoCoordinates,
  GeoBounds,
  HeightmapData,
  MapboxTileCoords,
} from "../../terrain-types";

/**
 * MapboxTerrainLoader
 * Not using inversify decorator - instantiated directly for now.
 */
export class MapboxTerrainLoader implements ITerrainLoader {
  private accessToken: string | null = null;

  constructor() {
    // Try to get token from environment or localStorage
    if (typeof window !== "undefined") {
      this.accessToken =
        localStorage.getItem("mapbox-access-token") ??
        (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) ??
        null;
    }
  }

  /**
   * Set the Mapbox access token
   */
  setAccessToken(token: string): void {
    this.accessToken = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("mapbox-access-token", token);
    }
  }

  isReady(): boolean {
    return this.accessToken !== null && this.accessToken.length > 0;
  }

  async loadHeightmap(
    bounds: GeoBounds,
    resolution: { width: number; height: number }
  ): Promise<HeightmapData> {
    if (!this.isReady()) {
      throw new Error("MapboxTerrainLoader: No access token configured");
    }

    // Determine appropriate zoom level based on bounds size
    const latSpan = Math.abs(bounds.nw.lat - bounds.se.lat);
    const lngSpan = Math.abs(bounds.se.lng - bounds.nw.lng);
    const zoom = this.calculateZoomLevel(latSpan, lngSpan);

    // Get all tiles that cover the bounds
    const tiles = this.getTilesForBounds(bounds, zoom);

    // Fetch and decode all tiles
    const tileData = await Promise.all(
      tiles.map((tile) => this.fetchAndDecodeTile(tile))
    );

    // Stitch tiles together and resample to desired resolution
    return this.stitchAndResample(tileData, tiles, bounds, resolution);
  }

  async getElevationAt(coord: GeoCoordinates): Promise<number | null> {
    if (!this.isReady()) return null;

    const zoom = 14; // Good balance of accuracy and tile size
    const tile = this.coordsToTile(coord, zoom);

    try {
      const tileData = await this.fetchAndDecodeTile(tile);
      // Calculate position within tile
      const { x: tileX, y: tileY } = this.getTilePixelCoords(coord, tile);
      const idx = tileY * 256 + tileX;
      return tileData[idx] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Convert geographic coordinates to tile coordinates
   */
  private coordsToTile(coord: GeoCoordinates, zoom: number): MapboxTileCoords {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((coord.lng + 180) / 360) * n);
    const latRad = (coord.lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return { x, y, z: zoom };
  }

  /**
   * Get all tiles that cover a bounding box
   */
  private getTilesForBounds(bounds: GeoBounds, zoom: number): MapboxTileCoords[] {
    const nwTile = this.coordsToTile(bounds.nw, zoom);
    const seTile = this.coordsToTile(bounds.se, zoom);

    const tiles: MapboxTileCoords[] = [];
    for (let x = nwTile.x; x <= seTile.x; x++) {
      for (let y = nwTile.y; y <= seTile.y; y++) {
        tiles.push({ x, y, z: zoom });
      }
    }
    return tiles;
  }

  /**
   * Calculate appropriate zoom level for a given span
   */
  private calculateZoomLevel(latSpan: number, lngSpan: number): number {
    const maxSpan = Math.max(latSpan, lngSpan);
    // Rough heuristic: larger spans need lower zoom
    if (maxSpan > 1) return 10;
    if (maxSpan > 0.1) return 12;
    if (maxSpan > 0.01) return 14;
    return 15; // Max useful zoom for terrain-RGB
  }

  /**
   * Fetch a terrain-RGB tile and decode to elevation values
   */
  private async fetchAndDecodeTile(tile: MapboxTileCoords): Promise<Float32Array> {
    const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${tile.z}/${tile.x}/${tile.y}.pngraw?access_token=${this.accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch terrain tile: ${response.status}`);
    }

    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    // Draw to canvas to extract pixel data
    const canvas = new OffscreenCanvas(256, 256);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, 256, 256);

    // Decode RGB to elevation
    const heights = new Float32Array(256 * 256);
    for (let i = 0; i < 256 * 256; i++) {
      const r = imageData.data[i * 4] ?? 0;
      const g = imageData.data[i * 4 + 1] ?? 0;
      const b = imageData.data[i * 4 + 2] ?? 0;
      // Mapbox terrain-RGB formula
      heights[i] = -10000 + (r * 256 * 256 + g * 256 + b) * 0.1;
    }

    return heights;
  }

  /**
   * Get pixel coordinates within a tile for a geographic point
   */
  private getTilePixelCoords(
    coord: GeoCoordinates,
    tile: MapboxTileCoords
  ): { x: number; y: number } {
    const n = Math.pow(2, tile.z);

    // Calculate fractional tile position
    const xFrac = ((coord.lng + 180) / 360) * n - tile.x;
    const latRad = (coord.lat * Math.PI) / 180;
    const yFrac =
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) *
        n -
      tile.y;

    return {
      x: Math.floor(xFrac * 256),
      y: Math.floor(yFrac * 256),
    };
  }

  /**
   * Stitch multiple tiles together and resample to desired resolution
   */
  private stitchAndResample(
    tileData: Float32Array[],
    tiles: MapboxTileCoords[],
    bounds: GeoBounds,
    resolution: { width: number; height: number }
  ): HeightmapData {
    const { width, height } = resolution;
    const heights = new Float32Array(width * height);

    let minElevation = Infinity;
    let maxElevation = -Infinity;

    // Sample at each output pixel
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Convert output pixel to geographic coords
        const lng = bounds.nw.lng + (x / (width - 1)) * (bounds.se.lng - bounds.nw.lng);
        const lat = bounds.nw.lat + (y / (height - 1)) * (bounds.se.lat - bounds.nw.lat);

        // Find which tile contains this point
        const elevation = this.sampleElevation(
          { lat, lng },
          tileData,
          tiles
        );

        heights[y * width + x] = elevation;
        minElevation = Math.min(minElevation, elevation);
        maxElevation = Math.max(maxElevation, elevation);
      }
    }

    return {
      heights,
      width,
      height,
      minElevation,
      maxElevation,
    };
  }

  /**
   * Sample elevation at a point from tile data
   */
  private sampleElevation(
    coord: GeoCoordinates,
    tileData: Float32Array[],
    tiles: MapboxTileCoords[]
  ): number {
    // Find tile containing this coord
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      if (!tile) continue;

      const { x, y } = this.getTilePixelCoords(coord, tile);
      const data = tileData[i];

      if (data && x >= 0 && x < 256 && y >= 0 && y < 256) {
        return data[y * 256 + x] ?? 0;
      }
    }

    // Fallback to first tile if coord is slightly out of bounds
    return tileData[0]?.[0] ?? 0;
  }
}
