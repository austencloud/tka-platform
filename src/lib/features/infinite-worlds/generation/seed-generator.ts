/**
 * Seeded Procedural Generation
 *
 * Deterministic generation using seeded random number generators.
 * Same seed + coordinates = same content. Always.
 *
 * Features:
 * - Reproducible worlds (seed = save file)
 * - Shareable worlds (same seed = identical experience)
 * - Multiplayer-ready (server validates against deterministic generation)
 * - No storage needed (regenerate any chunk on demand)
 */

// ============================================================================
// SEEDED RANDOM NUMBER GENERATOR
// ============================================================================

/**
 * Mulberry32 PRNG - fast, high-quality, 32-bit output
 * Based on the SplitMix64 algorithm
 */
export function mulberry32(seed: number): () => number {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/**
 * Create a seeded RNG from a world seed and chunk coordinates
 * This ensures each chunk has a unique but deterministic seed
 */
export function createChunkRNG(worldSeed: number, chunkX: number, chunkY: number, chunkZ: number): () => number {
  // Combine coordinates with world seed using hash function
  const chunkSeed = hashCoordinates(worldSeed, chunkX, chunkY, chunkZ);
  return mulberry32(chunkSeed);
}

/**
 * Hash function to combine seed with coordinates
 * Uses xxHash-inspired mixing for good distribution
 */
export function hashCoordinates(seed: number, x: number, y: number, z: number): number {
  let h = seed;
  h = Math.imul(h ^ x, 0x85ebca6b);
  h = Math.imul(h ^ y, 0xc2b2ae35);
  h = Math.imul(h ^ z, 0x27d4eb2f);
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * Hash a string to a number (for named seeds)
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash >>> 0;
}

// ============================================================================
// NOISE FUNCTIONS
// ============================================================================

/**
 * Permutation table for noise (seeded)
 */
function createPermutationTable(rng: () => number): Uint8Array {
  const p = new Uint8Array(512);
  const perm = new Uint8Array(256);

  // Initialize with values 0-255
  for (let i = 0; i < 256; i++) {
    perm[i] = i;
  }

  // Shuffle using Fisher-Yates
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = perm[i]!;
    perm[i] = perm[j]!;
    perm[j] = temp;
  }

  // Duplicate for wraparound
  for (let i = 0; i < 512; i++) {
    p[i] = perm[i & 255]!;
  }

  return p;
}

/**
 * Gradient vectors for 3D noise
 */
const GRADIENTS_3D: readonly [number, number, number][] = [
  [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
  [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
  [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1],
];

/**
 * Fade function for smooth interpolation
 */
function fade(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/**
 * Linear interpolation
 */
function lerp(a: number, b: number, t: number): number {
  return a + t * (b - a);
}

/**
 * Gradient function
 */
function grad(hash: number, x: number, y: number, z: number): number {
  const g = GRADIENTS_3D[hash % 12]!;
  return g[0] * x + g[1] * y + g[2] * z;
}

/**
 * Seeded Perlin noise generator
 */
export class SeededNoise {
  private perm: Uint8Array;

  constructor(seed: number) {
    const rng = mulberry32(seed);
    this.perm = createPermutationTable(rng);
  }

  /**
   * 3D Perlin noise
   * @returns Value in range [-1, 1]
   */
  noise3D(x: number, y: number, z: number): number {
    const p = this.perm;

    // Find unit cube
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;

    // Relative position in cube
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);

    // Fade curves
    const u = fade(x);
    const v = fade(y);
    const w = fade(z);

    // Hash coordinates
    const A = p[X]! + Y;
    const AA = p[A]! + Z;
    const AB = p[A + 1]! + Z;
    const B = p[X + 1]! + Y;
    const BA = p[B]! + Z;
    const BB = p[B + 1]! + Z;

    // Blend
    return lerp(
      lerp(
        lerp(grad(p[AA]!, x, y, z), grad(p[BA]!, x - 1, y, z), u),
        lerp(grad(p[AB]!, x, y - 1, z), grad(p[BB]!, x - 1, y - 1, z), u),
        v
      ),
      lerp(
        lerp(grad(p[AA + 1]!, x, y, z - 1), grad(p[BA + 1]!, x - 1, y, z - 1), u),
        lerp(grad(p[AB + 1]!, x, y - 1, z - 1), grad(p[BB + 1]!, x - 1, y - 1, z - 1), u),
        v
      ),
      w
    );
  }

  /**
   * Fractal Brownian Motion (FBM) - layered noise
   * @param octaves Number of noise layers
   * @param lacunarity Frequency multiplier per octave
   * @param persistence Amplitude multiplier per octave
   */
  fbm(x: number, y: number, z: number, octaves = 6, lacunarity = 2, persistence = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise3D(x * frequency, y * frequency, z * frequency);
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Ridged noise (for mountains)
   */
  ridged(x: number, y: number, z: number, octaves = 6, lacunarity = 2, persistence = 0.5): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      const n = 1 - Math.abs(this.noise3D(x * frequency, y * frequency, z * frequency));
      value += amplitude * n * n;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return value / maxValue;
  }

  /**
   * Domain warping for more organic shapes
   */
  warpedNoise(x: number, y: number, z: number, warpStrength = 0.5): number {
    const warpX = this.fbm(x + 5.2, y + 1.3, z + 2.8, 4);
    const warpY = this.fbm(x + 9.1, y + 4.7, z + 6.3, 4);
    const warpZ = this.fbm(x + 3.6, y + 8.2, z + 1.9, 4);

    return this.fbm(
      x + warpStrength * warpX,
      y + warpStrength * warpY,
      z + warpStrength * warpZ
    );
  }
}

// ============================================================================
// TERRAIN GENERATION
// ============================================================================

/**
 * Terrain height at a world position
 */
export function getTerrainHeight(noise: SeededNoise, worldX: number, worldZ: number, scale = 0.01): number {
  // Base terrain
  const base = noise.fbm(worldX * scale, 0, worldZ * scale, 6, 2, 0.5);

  // Mountains (higher frequency, more dramatic)
  const mountains = noise.ridged(worldX * scale * 0.5, 0, worldZ * scale * 0.5, 4, 2.2, 0.6);

  // Blend based on another noise layer
  const blend = (noise.fbm(worldX * scale * 0.2, 0, worldZ * scale * 0.2, 3) + 1) / 2;

  // Combine
  const height = lerp(base, mountains * 2, blend * blend);

  return height * 50; // Scale to world units
}

/**
 * Biome type at a world position
 */
export type BiomeType = "plains" | "forest" | "mountains" | "desert" | "ocean";

export function getBiome(noise: SeededNoise, worldX: number, worldZ: number): BiomeType {
  const temperature = (noise.fbm(worldX * 0.002, 0, worldZ * 0.002, 4) + 1) / 2;
  const moisture = (noise.fbm(worldX * 0.003 + 500, 0, worldZ * 0.003 + 500, 4) + 1) / 2;
  const height = getTerrainHeight(noise, worldX, worldZ);

  if (height < -10) return "ocean";
  if (height > 40) return "mountains";
  if (temperature > 0.7 && moisture < 0.3) return "desert";
  if (moisture > 0.5 && temperature > 0.3) return "forest";
  return "plains";
}

/**
 * Vegetation density at a position (0-1)
 */
export function getVegetationDensity(noise: SeededNoise, worldX: number, worldZ: number): number {
  const biome = getBiome(noise, worldX, worldZ);
  const base = (noise.fbm(worldX * 0.05, 0, worldZ * 0.05, 3) + 1) / 2;

  switch (biome) {
    case "forest": return base * 0.8 + 0.2;
    case "plains": return base * 0.3;
    case "mountains": return base * 0.1;
    case "desert": return 0;
    case "ocean": return 0;
  }
}

/**
 * Should place a tree at this position?
 */
export function shouldPlaceTree(
  worldSeed: number,
  worldX: number,
  worldZ: number,
  density: number,
  spacing = 3
): boolean {
  // Poisson-disk-like distribution using hash
  const cellX = Math.floor(worldX / spacing);
  const cellZ = Math.floor(worldZ / spacing);
  const hash = hashCoordinates(worldSeed, cellX, 0, cellZ);
  const rng = mulberry32(hash);

  // Random position within cell
  const offsetX = rng() * spacing;
  const offsetZ = rng() * spacing;
  const treeX = cellX * spacing + offsetX;
  const treeZ = cellZ * spacing + offsetZ;

  // Check if we're close to the tree position
  const dx = worldX - treeX;
  const dz = worldZ - treeZ;
  const distSq = dx * dx + dz * dz;

  // Tree exists if density check passes
  return distSq < 0.5 && rng() < density;
}

// ============================================================================
// WORLD SEED UTILITIES
// ============================================================================

/**
 * Generate a random world seed
 */
export function generateWorldSeed(): number {
  return Math.floor(Math.random() * 0xFFFFFFFF);
}

/**
 * Create a world seed from a string (for named worlds)
 */
export function worldSeedFromString(name: string): number {
  return hashString(name);
}

/**
 * Encode seed as a shareable string
 */
export function encodeSeed(seed: number): string {
  return seed.toString(36).toUpperCase();
}

/**
 * Decode seed from shareable string
 */
export function decodeSeed(encoded: string): number {
  return parseInt(encoded, 36);
}
