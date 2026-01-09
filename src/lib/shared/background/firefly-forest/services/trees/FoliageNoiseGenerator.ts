/**
 * Foliage Noise Generator
 *
 * Generates organic, noise-based foliage edges for tree silhouettes.
 * Creates the "fluffy" look of tree canopies and foliage clusters
 * using multiple octaves of noise for natural variation.
 */

import { PerlinNoise } from "../noise/PerlinNoise";

export interface FoliageEdgeConfig {
  // Primary noise characteristics
  noiseScale: number; // How "zoomed in" the noise is (smaller = larger features)
  noiseAmplitude: number; // How far edges deviate from base shape
  octaves: number; // Detail levels (more = finer detail)

  // Edge characteristics
  bumpiness: number; // 0-1, how bumpy vs smooth edges are
  irregularity: number; // 0-1, how random vs uniform bumps are
  density: number; // 0-1, how filled in vs sparse the foliage looks

  // Organic variation
  clumpiness: number; // 0-1, creates clusters of leaves
  leafScale: number; // Size of individual leaf-like bumps
}

export interface FoliageCluster {
  x: number;
  y: number;
  radius: number;
  edgePoints: Array<{ x: number; y: number }>;
  density: number;
}

const DEFAULT_CONFIG: FoliageEdgeConfig = {
  noiseScale: 0.05,
  noiseAmplitude: 15,
  octaves: 4,
  bumpiness: 0.6,
  irregularity: 0.4,
  density: 0.8,
  clumpiness: 0.5,
  leafScale: 5,
};

export class FoliageNoiseGenerator {
  private config: FoliageEdgeConfig;
  private noise: PerlinNoise;
  private noiseOffset: number;

  constructor(config: Partial<FoliageEdgeConfig> = {}, seed?: number) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.noise = new PerlinNoise(seed);
    this.noiseOffset = (seed ?? Math.random() * 1000) * 0.1;
  }

  /**
   * Generate edge points around a circular foliage cluster
   */
  generateCircularFoliage(
    centerX: number,
    centerY: number,
    baseRadius: number,
    pointCount: number = 32
  ): FoliageCluster {
    const points: Array<{ x: number; y: number }> = [];
    const { noiseScale, noiseAmplitude, octaves, bumpiness, irregularity, clumpiness, leafScale } =
      this.config;

    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;
      const baseX = centerX + Math.cos(angle) * baseRadius;
      const baseY = centerY + Math.sin(angle) * baseRadius;

      // Multi-octave noise for organic edge
      let radiusOffset = 0;

      // Primary noise layer (large features)
      radiusOffset +=
        this.noise.fbm(
          baseX * noiseScale + this.noiseOffset,
          baseY * noiseScale,
          octaves
        ) *
        noiseAmplitude *
        bumpiness;

      // Irregularity layer (medium variation)
      radiusOffset +=
        this.noise.noise2D(
          baseX * noiseScale * 2 + this.noiseOffset + 100,
          baseY * noiseScale * 2
        ) *
        noiseAmplitude *
        0.5 *
        irregularity;

      // Clumpiness - creates dense clusters
      const clumpNoise = this.noise.turbulence(
        baseX * noiseScale * 0.5 + this.noiseOffset + 200,
        baseY * noiseScale * 0.5,
        3
      );
      radiusOffset += clumpNoise * noiseAmplitude * clumpiness;

      // Leaf-scale detail (small bumps)
      radiusOffset +=
        this.noise.noise2D(
          baseX * (noiseScale * 4) + this.noiseOffset + 300,
          baseY * (noiseScale * 4)
        ) *
        leafScale *
        0.5;

      const finalRadius = baseRadius + radiusOffset;

      points.push({
        x: centerX + Math.cos(angle) * finalRadius,
        y: centerY + Math.sin(angle) * finalRadius,
      });
    }

    return {
      x: centerX,
      y: centerY,
      radius: baseRadius,
      edgePoints: points,
      density: this.config.density,
    };
  }

  /**
   * Generate edge points around an elliptical foliage area
   */
  generateEllipticalFoliage(
    centerX: number,
    centerY: number,
    radiusX: number,
    radiusY: number,
    pointCount: number = 48
  ): FoliageCluster {
    const points: Array<{ x: number; y: number }> = [];
    const { noiseScale, noiseAmplitude, octaves, bumpiness, clumpiness, leafScale } = this.config;

    for (let i = 0; i < pointCount; i++) {
      const angle = (i / pointCount) * Math.PI * 2;

      // Ellipse base position
      const baseX = centerX + Math.cos(angle) * radiusX;
      const baseY = centerY + Math.sin(angle) * radiusY;

      // Calculate distance from center for proper scaling
      const dist = Math.sqrt(
        Math.pow((baseX - centerX) / radiusX, 2) + Math.pow((baseY - centerY) / radiusY, 2)
      );

      // Multi-layer noise
      let offset = 0;

      // Primary shape noise
      offset +=
        this.noise.fbm(baseX * noiseScale + this.noiseOffset, baseY * noiseScale, octaves) *
        noiseAmplitude *
        bumpiness;

      // Clump layer
      offset +=
        this.noise.turbulence(
          baseX * noiseScale * 0.7 + this.noiseOffset + 150,
          baseY * noiseScale * 0.7,
          3
        ) *
        noiseAmplitude *
        0.6 *
        clumpiness;

      // Fine detail
      offset +=
        this.noise.noise2D(
          baseX * noiseScale * 3 + this.noiseOffset + 400,
          baseY * noiseScale * 3
        ) * leafScale;

      // Apply offset in the direction from center
      const normalX = (baseX - centerX) / (radiusX * dist || 1);
      const normalY = (baseY - centerY) / (radiusY * dist || 1);

      points.push({
        x: baseX + normalX * offset,
        y: baseY + normalY * offset,
      });
    }

    return {
      x: centerX,
      y: centerY,
      radius: Math.max(radiusX, radiusY),
      edgePoints: points,
      density: this.config.density,
    };
  }

  /**
   * Generate a tree crown silhouette with typical crown shape
   * (wider at bottom, narrower at top for deciduous trees)
   */
  generateCrownSilhouette(
    centerX: number,
    baseY: number,
    width: number,
    height: number,
    crownShape: "round" | "conical" | "spreading" | "columnar" = "round",
    pointCount: number = 64
  ): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    const { noiseScale, noiseAmplitude, octaves, bumpiness, clumpiness, leafScale } = this.config;

    // Crown center is above baseY
    const crownTop = baseY - height;
    const crownCenterY = baseY - height / 2;

    for (let i = 0; i < pointCount; i++) {
      const t = i / pointCount; // 0-1 around the crown
      const angle = t * Math.PI * 2 - Math.PI / 2; // Start at top

      // Calculate base width at this height based on crown shape
      const heightT = (Math.sin(angle) + 1) / 2; // 0 at top, 1 at bottom

      let widthMultiplier: number;
      switch (crownShape) {
        case "conical":
          widthMultiplier = heightT * 0.8 + 0.2;
          break;
        case "spreading":
          widthMultiplier = Math.pow(heightT, 0.5) * 0.9 + 0.1;
          break;
        case "columnar":
          widthMultiplier = 0.6 + heightT * 0.2;
          break;
        case "round":
        default:
          // Natural egg shape
          widthMultiplier = Math.sin(heightT * Math.PI) * 0.8 + 0.4;
          break;
      }

      const localWidth = (width / 2) * widthMultiplier;
      const localHeight = height / 2;

      // Base position
      const baseX = centerX + Math.cos(angle) * localWidth;
      const baseYPos = crownCenterY + Math.sin(angle) * localHeight;

      // Multi-layer noise for organic edge
      let offset = 0;

      // Primary bumps
      offset +=
        this.noise.fbm(
          baseX * noiseScale + this.noiseOffset,
          baseYPos * noiseScale,
          octaves
        ) *
        noiseAmplitude *
        bumpiness;

      // Clump variation
      offset +=
        this.noise.turbulence(
          baseX * noiseScale * 0.6 + this.noiseOffset + 250,
          baseYPos * noiseScale * 0.6,
          3
        ) *
        noiseAmplitude *
        0.5 *
        clumpiness;

      // Leaf detail
      offset +=
        this.noise.noise2D(
          baseX * noiseScale * 4 + this.noiseOffset + 500,
          baseYPos * noiseScale * 4
        ) * leafScale;

      // Apply noise outward from center
      const dx = baseX - centerX;
      const dy = baseYPos - crownCenterY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      points.push({
        x: baseX + (dx / dist) * offset,
        y: baseYPos + (dy / dist) * offset,
      });
    }

    return points;
  }

  /**
   * Generate multiple small foliage clusters for sparse canopy
   */
  generateFoliageClusters(
    centerX: number,
    centerY: number,
    spreadX: number,
    spreadY: number,
    clusterCount: number,
    minRadius: number,
    maxRadius: number
  ): FoliageCluster[] {
    const clusters: FoliageCluster[] = [];

    for (let i = 0; i < clusterCount; i++) {
      // Position clusters with noise-based distribution
      const noiseX = this.noise.noise2D(i * 0.3 + this.noiseOffset, 0);
      const noiseY = this.noise.noise2D(i * 0.3 + this.noiseOffset, 100);

      const x = centerX + noiseX * spreadX;
      const y = centerY + noiseY * spreadY;

      // Vary radius
      const radiusNoise = (this.noise.noise2D(i * 0.5 + this.noiseOffset, 200) + 1) / 2;
      const radius = minRadius + radiusNoise * (maxRadius - minRadius);

      // Generate cluster with varying detail based on size
      const pointCount = Math.max(12, Math.floor(radius * 2));
      clusters.push(this.generateCircularFoliage(x, y, radius, pointCount));
    }

    return clusters;
  }

  /**
   * Sample a single noise value for edge displacement
   * Useful for applying to pre-existing geometry
   */
  sampleEdgeNoise(x: number, y: number): number {
    const { noiseScale, noiseAmplitude, octaves, bumpiness } = this.config;

    return (
      this.noise.fbm(x * noiseScale + this.noiseOffset, y * noiseScale, octaves) *
      noiseAmplitude *
      bumpiness
    );
  }

  /**
   * Apply foliage noise to an existing set of points
   * Useful for adding organic edges to simple shapes
   */
  applyNoiseToPoints(
    points: Array<{ x: number; y: number }>,
    centerX: number,
    centerY: number
  ): Array<{ x: number; y: number }> {
    return points.map((point) => {
      const dx = point.x - centerX;
      const dy = point.y - centerY;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;

      const offset = this.sampleEdgeNoise(point.x, point.y);

      return {
        x: point.x + (dx / dist) * offset,
        y: point.y + (dy / dist) * offset,
      };
    });
  }
}

/**
 * Create foliage configs for different tree types
 */
export const FOLIAGE_PRESETS: Record<string, Partial<FoliageEdgeConfig>> = {
  oak: {
    noiseScale: 0.04,
    noiseAmplitude: 18,
    octaves: 5,
    bumpiness: 0.7,
    clumpiness: 0.6,
    leafScale: 6,
  },
  maple: {
    noiseScale: 0.05,
    noiseAmplitude: 15,
    octaves: 4,
    bumpiness: 0.65,
    clumpiness: 0.5,
    leafScale: 5,
  },
  pine: {
    noiseScale: 0.08,
    noiseAmplitude: 8,
    octaves: 3,
    bumpiness: 0.4,
    clumpiness: 0.3,
    leafScale: 3,
  },
  willow: {
    noiseScale: 0.03,
    noiseAmplitude: 20,
    octaves: 4,
    bumpiness: 0.5,
    clumpiness: 0.7,
    leafScale: 4,
  },
  bush: {
    noiseScale: 0.06,
    noiseAmplitude: 12,
    octaves: 4,
    bumpiness: 0.8,
    clumpiness: 0.4,
    leafScale: 4,
  },
};
