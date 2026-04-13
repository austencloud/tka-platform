/**
 * Video Export Calculation Helpers
 *
 * Shared dimension and bitrate calculations used by both the 2D
 * VideoExportOrchestrator and the 3D Offline3DExporter.
 */

/**
 * Map a target resolution + aspect ratio to concrete pixel dimensions.
 * Ensures both width and height are even (H.264 requirement).
 */
export function getExportDimensions(
  resolution: number,
  aspectRatio: number
): { width: number; height: number } {
  const heightMap: Record<number, number> = { 720: 720, 1080: 1080, 2160: 2160, 4320: 4320 };
  const height = heightMap[resolution] ?? 1080;
  let width = Math.round(height * aspectRatio);
  // H.264 requires even dimensions
  width = width % 2 === 0 ? width : width + 1;
  return { width, height };
}

/**
 * Auto-scale bitrate based on pixel count and frame rate.
 *
 * Base rates:
 *   - 720p  (921 600 px): 4 Mbps
 *   - 1080p (2 073 600 px): 6 Mbps
 *   - 2160p (8 294 400 px): 20 Mbps
 *   - 4320p+: 50 Mbps
 *
 * FPS multipliers:
 *   - <= 30 fps: 1x
 *   - 31-60 fps: 1.33x
 *   - > 60 fps:  2.5x
 */
export function calculateBitrate(width: number, height: number, fps: number): number {
  const pixels = width * height;
  const base =
    pixels <= 1280 * 720 ? 4_000_000 :
    pixels <= 1920 * 1080 ? 6_000_000 :
    pixels <= 3840 * 2160 ? 20_000_000 :
    50_000_000;
  const fpsMultiplier = fps <= 30 ? 1 : fps <= 60 ? 1.33 : 2.5;
  return Math.round(base * fpsMultiplier);
}
