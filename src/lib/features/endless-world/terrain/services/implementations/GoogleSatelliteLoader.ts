/**
 * GoogleSatelliteLoader
 *
 * Loads satellite imagery from Google Maps Static API.
 * Generally higher quality than Mapbox in rural US areas.
 */

import type { GeoBounds } from "../../terrain-types";

export class GoogleSatelliteLoader {
  private apiKey: string | null = null;

  constructor() {
    if (typeof window !== "undefined") {
      this.apiKey =
        localStorage.getItem("google-maps-api-key") ??
        (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string) ??
        null;
    }
  }

  setApiKey(key: string): void {
    this.apiKey = key;
    if (typeof window !== "undefined") {
      localStorage.setItem("google-maps-api-key", key);
    }
  }

  isReady(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * Load satellite imagery for bounds as a single image
   * Uses Google Maps Static API
   */
  async loadSatelliteTexture(
    bounds: GeoBounds,
    resolution: { width: number; height: number }
  ): Promise<HTMLCanvasElement> {
    if (!this.isReady()) {
      throw new Error("GoogleSatelliteLoader: No API key configured");
    }

    // Calculate center point
    const centerLat = (bounds.nw.lat + bounds.se.lat) / 2;
    const centerLng = (bounds.nw.lng + bounds.se.lng) / 2;

    // Calculate appropriate zoom level based on bounds
    // At zoom 17, each pixel is ~1.2m at this latitude
    const latSpan = bounds.nw.lat - bounds.se.lat;
    const zoom = this.calculateZoom(latSpan, resolution.height);

    // Google Static Maps max size is 640x640 without premium
    // We'll fetch multiple tiles and stitch them
    const canvas = document.createElement("canvas");
    canvas.width = resolution.width;
    canvas.height = resolution.height;
    const ctx = canvas.getContext("2d")!;

    // For now, fetch a single high-res image at scale=2
    // Max is 640x640 * 2 = 1280x1280 pixels
    const url = this.buildStaticMapUrl(centerLat, centerLng, zoom, 640, 640, 2);

    const img = await this.loadImage(url);

    // Draw to canvas, stretching to fill
    ctx.drawImage(img, 0, 0, resolution.width, resolution.height);

    return canvas;
  }

  private calculateZoom(latSpan: number, heightPx: number): number {
    // Approximate meters per degree latitude
    const metersPerDegree = 111320;
    const spanMeters = latSpan * metersPerDegree;

    // At zoom 0, world is 256px. Each zoom doubles resolution.
    // Target: spanMeters should fit in heightPx
    // At zoom z, meters per pixel = 156543 * cos(lat) / 2^z
    // For simplicity, use zoom 18-19 for tight property views

    if (spanMeters < 200) return 19;
    if (spanMeters < 400) return 18;
    if (spanMeters < 800) return 17;
    if (spanMeters < 1600) return 16;
    return 15;
  }

  private buildStaticMapUrl(
    lat: number,
    lng: number,
    zoom: number,
    width: number,
    height: number,
    scale: number
  ): string {
    const params = new URLSearchParams({
      center: `${lat},${lng}`,
      zoom: zoom.toString(),
      size: `${width}x${height}`,
      scale: scale.toString(),
      maptype: "satellite",
      key: this.apiKey!,
    });

    return `https://maps.googleapis.com/maps/api/staticmap?${params}`;
  }

  private loadImage(url: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Failed to load Google satellite image"));
      img.src = url;
    });
  }
}
