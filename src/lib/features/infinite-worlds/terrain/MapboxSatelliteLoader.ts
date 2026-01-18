/**
 * MapboxSatelliteLoader
 *
 * Loads satellite imagery tiles from Mapbox to texture terrain.
 * Uses the mapbox.satellite tileset.
 */

import type { GeoBounds, MapboxTileCoords } from "./terrain-types";

export class MapboxSatelliteLoader {
  private accessToken: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.accessToken =
        localStorage.getItem("mapbox-access-token") ??
        (import.meta.env.VITE_MAPBOX_ACCESS_TOKEN as string) ??
        null;
    }
  }

  setAccessToken(token: string): void {
    this.accessToken = token;
    if (typeof window !== "undefined") {
      localStorage.setItem("mapbox-access-token", token);
    }
  }

  isReady(): boolean {
    return this.accessToken !== null && this.accessToken.length > 0;
  }

  /**
   * Load satellite imagery for bounds and return as a single stitched image
   * @param bounds Geographic bounds to capture
   * @param resolution Output resolution
   * @param zoom Zoom level (default 15, max 18 for highest detail)
   */
  async loadSatelliteTexture(
    bounds: GeoBounds,
    resolution: { width: number; height: number },
    zoom: number = 17
  ): Promise<HTMLCanvasElement> {
    if (!this.isReady()) {
      throw new Error("MapboxSatelliteLoader: No access token configured");
    }

    // Clamp zoom to valid range (0-18 for Mapbox satellite)
    const clampedZoom = Math.max(0, Math.min(18, zoom));
    const tiles = this.getTilesForBounds(bounds, clampedZoom);

    // Fetch all satellite tiles
    const tileImages = await Promise.all(
      tiles.map((tile) => this.fetchTileImage(tile))
    );

    // Stitch into single canvas matching the bounds
    return this.stitchTiles(tileImages, tiles, bounds, resolution);
  }

  /**
   * Convert geographic coordinates to tile coordinates
   */
  private coordsToTile(lat: number, lng: number, zoom: number): MapboxTileCoords {
    const n = Math.pow(2, zoom);
    const x = Math.floor(((lng + 180) / 360) * n);
    const latRad = (lat * Math.PI) / 180;
    const y = Math.floor(
      ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
    );
    return { x, y, z: zoom };
  }

  /**
   * Get all tiles covering bounds
   */
  private getTilesForBounds(bounds: GeoBounds, zoom: number): MapboxTileCoords[] {
    const nwTile = this.coordsToTile(bounds.nw.lat, bounds.nw.lng, zoom);
    const seTile = this.coordsToTile(bounds.se.lat, bounds.se.lng, zoom);

    const tiles: MapboxTileCoords[] = [];
    for (let y = nwTile.y; y <= seTile.y; y++) {
      for (let x = nwTile.x; x <= seTile.x; x++) {
        tiles.push({ x, y, z: zoom });
      }
    }
    return tiles;
  }

  /**
   * Fetch a single satellite tile
   */
  private async fetchTileImage(tile: MapboxTileCoords): Promise<ImageBitmap> {
    const url = `https://api.mapbox.com/v4/mapbox.satellite/${tile.z}/${tile.x}/${tile.y}@2x.jpg?access_token=${this.accessToken}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch satellite tile: ${response.status}`);
    }

    const blob = await response.blob();
    return createImageBitmap(blob);
  }

  /**
   * Stitch tiles into a single canvas
   */
  private stitchTiles(
    images: ImageBitmap[],
    tiles: MapboxTileCoords[],
    bounds: GeoBounds,
    resolution: { width: number; height: number }
  ): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext("2d")!;

    // Calculate tile grid dimensions
    const minX = Math.min(...tiles.map((t) => t.x));
    const maxX = Math.max(...tiles.map((t) => t.x));
    const minY = Math.min(...tiles.map((t) => t.y));
    const maxY = Math.max(...tiles.map((t) => t.y));

    const tilesWide = maxX - minX + 1;
    const tilesHigh = maxY - minY + 1;

    // Create intermediate canvas for full tile grid
    const tileSize = 512; // @2x tiles are 512px
    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = tilesWide * tileSize;
    fullCanvas.height = tilesHigh * tileSize;
    const fullCtx = fullCanvas.getContext("2d")!;

    // Draw each tile to full canvas
    for (let i = 0; i < tiles.length; i++) {
      const tile = tiles[i];
      const img = images[i];
      if (!tile || !img) continue;

      const dx = (tile.x - minX) * tileSize;
      const dy = (tile.y - minY) * tileSize;
      fullCtx.drawImage(img, dx, dy, tileSize, tileSize);
    }

    // Calculate the pixel bounds within the tile grid
    const zoom = tiles[0]?.z ?? 15;
    const n = Math.pow(2, zoom);

    // NW corner in tile pixels
    const nwTileX = ((bounds.nw.lng + 180) / 360) * n;
    const nwLatRad = (bounds.nw.lat * Math.PI) / 180;
    const nwTileY =
      ((1 - Math.log(Math.tan(nwLatRad) + 1 / Math.cos(nwLatRad)) / Math.PI) / 2) * n;

    // SE corner in tile pixels
    const seTileX = ((bounds.se.lng + 180) / 360) * n;
    const seLatRad = (bounds.se.lat * Math.PI) / 180;
    const seTileY =
      ((1 - Math.log(Math.tan(seLatRad) + 1 / Math.cos(seLatRad)) / Math.PI) / 2) * n;

    // Convert to pixel offsets within the stitched image
    const srcX = (nwTileX - minX) * tileSize;
    const srcY = (nwTileY - minY) * tileSize;
    const srcWidth = (seTileX - nwTileX) * tileSize;
    const srcHeight = (seTileY - nwTileY) * tileSize;

    // Draw cropped region to output canvas
    ctx.drawImage(
      fullCanvas,
      srcX,
      srcY,
      srcWidth,
      srcHeight,
      0,
      0,
      resolution.width,
      resolution.height
    );

    return canvas;
  }
}
