/**
 * Procedural Heightmap Generation
 *
 * Creates synthetic terrain data for testing and fallback when
 * real elevation data isn't available.
 */

import type { HeightmapData } from "./terrain-types";

/**
 * Simple 2D noise function (value noise)
 */
function noise2D(x: number, y: number, seed: number = 0): number {
  // Hash function for pseudo-random values
  const hash = (xi: number, yi: number) => {
    const n = xi + yi * 57 + seed * 131;
    const h = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff;
    return h / 0x7fffffff;
  };

  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  // Smooth interpolation
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  // Corner values
  const n00 = hash(x0, y0);
  const n10 = hash(x0 + 1, y0);
  const n01 = hash(x0, y0 + 1);
  const n11 = hash(x0 + 1, y0 + 1);

  // Bilinear interpolation
  const n0 = n00 * (1 - sx) + n10 * sx;
  const n1 = n01 * (1 - sx) + n11 * sx;
  return n0 * (1 - sy) + n1 * sy;
}

/**
 * Fractal Brownian Motion - layered noise
 */
function fbm(x: number, y: number, octaves: number = 6, persistence: number = 0.5): number {
  let value = 0;
  let amplitude = 1;
  let frequency = 1;
  let maxValue = 0;

  for (let i = 0; i < octaves; i++) {
    value += noise2D(x * frequency, y * frequency, i) * amplitude;
    maxValue += amplitude;
    amplitude *= persistence;
    frequency *= 2;
  }

  return value / maxValue;
}

export interface ProceduralTerrainOptions {
  /** Width in samples */
  width: number;
  /** Height in samples */
  height: number;
  /** Noise scale (larger = more zoomed in) */
  scale?: number;
  /** Number of noise octaves */
  octaves?: number;
  /** Persistence for each octave */
  persistence?: number;
  /** Minimum elevation in meters */
  minElevation?: number;
  /** Maximum elevation in meters */
  maxElevation?: number;
  /** Random seed */
  seed?: number;
}

/**
 * Generate a procedural heightmap using layered noise
 */
export function generateProceduralHeightmap(
  options: ProceduralTerrainOptions
): HeightmapData {
  const {
    width,
    height,
    scale = 0.02,
    octaves = 6,
    persistence = 0.5,
    minElevation = 280,  // ~920 feet - typical Ohio elevation
    maxElevation = 320,  // ~1050 feet - some hills
    seed = 42,
  } = options;

  const heights = new Float32Array(width * height);
  let actualMin = Infinity;
  let actualMax = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Generate noise value (0-1)
      let noiseValue = fbm(
        x * scale + seed * 100,
        y * scale + seed * 100,
        octaves,
        persistence
      );

      // Add some variation: rolling hills with occasional steeper areas
      const hilliness = fbm(x * scale * 0.3, y * scale * 0.3, 3, 0.7);
      noiseValue = noiseValue * (0.5 + hilliness * 0.5);

      // Map to elevation range
      const elevation = minElevation + noiseValue * (maxElevation - minElevation);
      heights[y * width + x] = elevation;

      actualMin = Math.min(actualMin, elevation);
      actualMax = Math.max(actualMax, elevation);
    }
  }

  return {
    heights,
    width,
    height,
    minElevation: actualMin,
    maxElevation: actualMax,
  };
}

/**
 * Generate terrain that resembles a campground with:
 * - Relatively flat areas (camping spots)
 * - Some gentle rolling hills
 * - A few paths/roads (lower elevation)
 */
export function generateCampgroundTerrain(
  width: number = 256,
  height: number = 256
): HeightmapData {
  const heights = new Float32Array(width * height);

  // Base Ohio elevation ~290m (950 feet)
  const baseElevation = 290;
  const hillRange = 25; // Up to 25m of variation

  let minElev = Infinity;
  let maxElev = -Infinity;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const v = y / height;

      // Base rolling terrain
      let elevation = baseElevation;

      // Large-scale gentle hills
      elevation += fbm(u * 3, v * 3, 4, 0.6) * hillRange * 0.6;

      // Medium-scale variation
      elevation += fbm(u * 8, v * 8, 3, 0.5) * hillRange * 0.3;

      // Small-scale texture
      elevation += fbm(u * 20, v * 20, 2, 0.4) * hillRange * 0.1;

      // Create some flatter "cleared" areas (campsites)
      const clearingNoise = fbm(u * 5 + 50, v * 5 + 50, 2, 0.5);
      if (clearingNoise > 0.6) {
        // Flatten this area somewhat
        const flatness = (clearingNoise - 0.6) / 0.4;
        const targetElev = baseElevation + 5;
        elevation = elevation * (1 - flatness * 0.5) + targetElev * flatness * 0.5;
      }

      heights[y * width + x] = elevation;
      minElev = Math.min(minElev, elevation);
      maxElev = Math.max(maxElev, elevation);
    }
  }

  return {
    heights,
    width,
    height,
    minElevation: minElev,
    maxElevation: maxElev,
  };
}
