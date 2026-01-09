/**
 * Perlin Noise Implementation
 *
 * Classic Perlin noise for organic texture generation.
 * Used for foliage edges, terrain variation, and natural randomness.
 *
 * Based on Ken Perlin's improved noise algorithm.
 */

export class PerlinNoise {
  private readonly permutation: number[];
  private readonly p: number[];

  constructor(seed?: number) {
    // Generate permutation table
    this.permutation = this.generatePermutation(seed);
    // Double it to avoid overflow
    this.p = [...this.permutation, ...this.permutation];
  }

  private generatePermutation(seed?: number): number[] {
    const perm = Array.from({ length: 256 }, (_, i) => i);

    // Seeded shuffle using simple LCG
    let s = seed ?? Math.floor(Math.random() * 2147483647);
    const random = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };

    // Fisher-Yates shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      const temp = perm[i]!;
      perm[i] = perm[j]!;
      perm[j] = temp;
    }

    return perm;
  }

  private fade(t: number): number {
    // 6t^5 - 15t^4 + 10t^3 (improved smoothstep)
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(a: number, b: number, t: number): number {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    // Convert low 4 bits of hash into gradient direction
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  /**
   * 2D Perlin noise
   * @returns Value between -1 and 1
   */
  noise2D(x: number, y: number): number {
    // Find unit grid cell
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    // Get relative position in cell
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);

    // Compute fade curves
    const u = this.fade(xf);
    const v = this.fade(yf);

    // Hash coordinates of cube corners
    const aa = this.p[this.p[X]! + Y]!;
    const ab = this.p[this.p[X]! + Y + 1]!;
    const ba = this.p[this.p[X + 1]! + Y]!;
    const bb = this.p[this.p[X + 1]! + Y + 1]!;

    // Blend results from corners
    const x1 = this.lerp(this.grad(aa, xf, yf), this.grad(ba, xf - 1, yf), u);
    const x2 = this.lerp(this.grad(ab, xf, yf - 1), this.grad(bb, xf - 1, yf - 1), u);

    return this.lerp(x1, x2, v);
  }

  /**
   * Fractal Brownian Motion (fBm) - stacked octaves of noise
   * Creates more natural, detailed textures
   *
   * @param x - X coordinate
   * @param y - Y coordinate
   * @param octaves - Number of noise layers (more = more detail)
   * @param persistence - How much each octave contributes (0.5 typical)
   * @param lacunarity - Frequency multiplier per octave (2.0 typical)
   * @returns Value roughly between -1 and 1
   */
  fbm(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += this.noise2D(x * frequency, y * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Ridge noise - creates sharp ridges, good for mountain silhouettes
   */
  ridgeNoise(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      // Take absolute value and invert to create ridges
      const n = 1 - Math.abs(this.noise2D(x * frequency, y * frequency));
      total += n * n * amplitude; // Square for sharper ridges
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }

  /**
   * Turbulence - absolute value noise, always positive, good for clouds/foliage
   */
  turbulence(
    x: number,
    y: number,
    octaves: number = 4,
    persistence: number = 0.5,
    lacunarity: number = 2.0
  ): number {
    let total = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      total += Math.abs(this.noise2D(x * frequency, y * frequency)) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }

    return total / maxValue;
  }
}

// Singleton instance with default seed for consistent results
let defaultInstance: PerlinNoise | null = null;

export function getPerlinNoise(seed?: number): PerlinNoise {
  if (seed !== undefined) {
    return new PerlinNoise(seed);
  }
  if (!defaultInstance) {
    defaultInstance = new PerlinNoise(42);
  }
  return defaultInstance;
}
