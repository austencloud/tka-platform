import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";

// ============================================================================
// PROCEDURAL NEBULA SYSTEM
// ============================================================================
// Generates organic, flowing nebula clouds using layered noise functions.
// No geometric shapes - purely procedural generation for natural appearance.
//
// Based on: https://wwwtyro.net/2016/10/22/2D-space-scene-procgen.html
// ============================================================================

/** Configuration for a single nebula cloud */
interface NebulaCloud {
  /** Center position (normalized 0-1) */
  centerX: number;
  centerY: number;
  /** Base radius as fraction of screen diagonal */
  radiusFraction: number;
  /** Color palette for this nebula */
  palette: NebulaColorPalette;
  /** Noise seed offset for this nebula */
  seedOffset: number;
  /** Animation phase */
  phase: number;
  /** Rotation angle */
  rotation: number;
}

interface NebulaColorPalette {
  /** Core color (brightest) */
  core: { r: number; g: number; b: number };
  /** Mid color */
  mid: { r: number; g: number; b: number };
  /** Edge color */
  edge: { r: number; g: number; b: number };
}

/** Pre-defined nebula color palettes based on real emission nebulae */
const NEBULA_PALETTES: NebulaColorPalette[] = [
  // Orion-like (pink/magenta emission)
  {
    core: { r: 255, g: 180, b: 220 },
    mid: { r: 200, g: 100, b: 180 },
    edge: { r: 120, g: 80, b: 160 },
  },
  // Reflection nebula (cool blue)
  {
    core: { r: 180, g: 200, b: 255 },
    mid: { r: 120, g: 150, b: 220 },
    edge: { r: 80, g: 100, b: 180 },
  },
  // Carina-like (warm orange/salmon)
  {
    core: { r: 255, g: 200, b: 160 },
    mid: { r: 220, g: 140, b: 120 },
    edge: { r: 180, g: 100, b: 120 },
  },
  // Eagle nebula (teal/cyan)
  {
    core: { r: 150, g: 220, b: 220 },
    mid: { r: 100, g: 160, b: 180 },
    edge: { r: 80, g: 120, b: 160 },
  },
];

export class ProceduralNebulaSystem {
  private clouds: NebulaCloud[] = [];
  private dimensions: Dimensions = { width: 0, height: 0 };
  private quality: QualityLevel = "high";
  private isEnabled: boolean = false;

  // Pre-computed noise lookup for performance
  private noiseCache: Float32Array | null = null;
  private noiseCacheSize = 256;

  // Animation time accumulator
  private time: number = 0;

  // Quality settings - DISABLED until optimized with offscreen canvas caching
  // The per-frame noise sampling was causing severe performance issues
  private readonly QUALITY_CONFIG = {
    high: { cloudCount: 0, resolution: 4, layers: 4 },
    medium: { cloudCount: 0, resolution: 6, layers: 3 },
    low: { cloudCount: 0, resolution: 8, layers: 2 },
    minimal: { cloudCount: 0, resolution: 0, layers: 0 },
    "ultra-minimal": { cloudCount: 0, resolution: 0, layers: 0 },
  };

  constructor() {
    this.initNoiseCache();
  }

  /**
   * Pre-compute noise values for fast lookup
   */
  private initNoiseCache() {
    this.noiseCache = new Float32Array(this.noiseCacheSize * this.noiseCacheSize);
    for (let y = 0; y < this.noiseCacheSize; y++) {
      for (let x = 0; x < this.noiseCacheSize; x++) {
        const idx = y * this.noiseCacheSize + x;
        this.noiseCache[idx] = this.rawNoise(x * 0.1, y * 0.1);
      }
    }
  }

  /**
   * Raw noise function using layered sine waves (approximates Simplex noise)
   * This avoids external dependencies while providing organic-looking results
   */
  private rawNoise(x: number, y: number): number {
    // Layer multiple sine waves at different frequencies and angles
    // This creates organic, cloud-like patterns
    const n1 = Math.sin(x * 1.0 + y * 0.5) * Math.cos(y * 0.8 - x * 0.3);
    const n2 = Math.sin(x * 2.1 - y * 1.3) * Math.cos(y * 1.7 + x * 0.9) * 0.5;
    const n3 = Math.sin(x * 4.3 + y * 3.7) * Math.cos(y * 2.9 - x * 2.1) * 0.25;
    const n4 = Math.sin(x * 8.7 - y * 7.3) * Math.cos(y * 6.1 + x * 5.3) * 0.125;

    return (n1 + n2 + n3 + n4) / 1.875; // Normalize to roughly -1 to 1
  }

  /**
   * Sample noise with interpolation from cache for animation
   */
  private sampleNoise(x: number, y: number, seed: number = 0): number {
    // Add seed offset and time for animation
    const sx = x + seed * 100;
    const sy = y + seed * 73;

    // Use raw noise for smooth animation (cache is for static patterns)
    return this.rawNoise(sx, sy);
  }

  /**
   * Fractal Brownian Motion - layered noise for natural cloud shapes
   */
  private fbm(x: number, y: number, seed: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.sampleNoise(x * frequency, y * frequency, seed + i * 10);
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }

    return value / maxValue;
  }

  initialize(dim: Dimensions, quality: QualityLevel) {
    this.dimensions = dim;
    this.quality = quality;

    const config = this.QUALITY_CONFIG[quality];
    this.isEnabled = config.cloudCount > 0;

    if (!this.isEnabled) {
      this.clouds = [];
      return;
    }

    // Generate nebula clouds
    this.clouds = [];
    for (let i = 0; i < config.cloudCount; i++) {
      this.clouds.push(this.generateCloud(i, config.cloudCount));
    }
  }

  private generateCloud(index: number, total: number): NebulaCloud {
    // Distribute clouds across the sky
    // Avoid center and edges for natural placement
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 0.2 + Math.random() * 0.3; // 20-50% from center

    return {
      centerX: 0.5 + Math.cos(angle) * distance,
      centerY: 0.5 + Math.sin(angle) * distance,
      radiusFraction: 0.15 + Math.random() * 0.15, // 15-30% of diagonal
      palette: NEBULA_PALETTES[index % NEBULA_PALETTES.length],
      seedOffset: Math.random() * 1000,
      phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
    };
  }

  update(a11y: AccessibilitySettings, frameMultiplier: number = 1.0) {
    if (!this.isEnabled) return;

    // Very slow animation - nebulae should feel massive and distant
    const speed = a11y.reducedMotion ? 0.00002 : 0.0001;
    this.time += speed * frameMultiplier;

    // Update cloud phases for subtle pulsing
    for (const cloud of this.clouds) {
      cloud.phase += 0.0005 * frameMultiplier * (a11y.reducedMotion ? 0.2 : 1);
    }
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings) {
    if (!this.isEnabled || this.clouds.length === 0) return;

    const config = this.QUALITY_CONFIG[this.quality];
    const { width, height } = this.dimensions;
    const diagonal = Math.sqrt(width * width + height * height);

    // Use screen blend mode for additive glow
    ctx.globalCompositeOperation = "screen";

    for (const cloud of this.clouds) {
      this.drawCloud(ctx, cloud, diagonal, config, a11y);
    }

    ctx.globalCompositeOperation = "source-over";
  }

  private drawCloud(
    ctx: CanvasRenderingContext2D,
    cloud: NebulaCloud,
    diagonal: number,
    config: { resolution: number; layers: number },
    a11y: AccessibilitySettings
  ) {
    const { width, height } = this.dimensions;
    const centerX = cloud.centerX * width;
    const centerY = cloud.centerY * height;
    const radius = cloud.radiusFraction * diagonal;

    // Sample grid for the nebula region
    const resolution = config.resolution;
    const sampleSize = radius * 2;
    const step = resolution;

    // Pulsing intensity
    const pulse = 0.8 + 0.2 * Math.sin(cloud.phase);
    const baseAlpha = (a11y.reducedMotion ? 0.03 : 0.05) * pulse;

    // Draw from outside in for proper layering
    const startX = Math.max(0, centerX - radius);
    const endX = Math.min(width, centerX + radius);
    const startY = Math.max(0, centerY - radius);
    const endY = Math.min(height, centerY + radius);

    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        // Distance from center (normalized)
        const dx = (x - centerX) / radius;
        const dy = (y - centerY) / radius;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.2) continue; // Skip outside nebula

        // Rotate coordinates for variety
        const rotX = dx * Math.cos(cloud.rotation) - dy * Math.sin(cloud.rotation);
        const rotY = dx * Math.sin(cloud.rotation) + dy * Math.cos(cloud.rotation);

        // Sample noise at this position with time animation
        const noiseX = rotX * 3 + this.time;
        const noiseY = rotY * 3;
        const density = this.fbm(noiseX, noiseY, cloud.seedOffset, config.layers);

        // Convert noise to density (threshold for cloud shape)
        // Use distance falloff for soft edges
        const falloff = 1 - Math.pow(dist, 1.5);
        const cloudDensity = Math.max(0, (density * 0.5 + 0.5) * falloff);

        if (cloudDensity < 0.1) continue; // Skip very thin areas

        // Color based on distance from center
        const color = this.getNebulaColor(cloud.palette, dist, cloudDensity);
        const alpha = cloudDensity * baseAlpha;

        // Draw soft blob
        const blobRadius = step * (0.8 + cloudDensity * 0.4);
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, blobRadius);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.5})`);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, blobRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Add a few embedded bright spots (star-forming regions)
    this.drawEmbeddedStars(ctx, cloud, centerX, centerY, radius, baseAlpha);
  }

  private getNebulaColor(
    palette: NebulaColorPalette,
    distance: number,
    density: number
  ): { r: number; g: number; b: number } {
    // Interpolate between core, mid, and edge colors based on distance
    const t = Math.min(1, distance);

    let r: number, g: number, b: number;

    if (t < 0.4) {
      // Core to mid transition
      const localT = t / 0.4;
      r = palette.core.r + (palette.mid.r - palette.core.r) * localT;
      g = palette.core.g + (palette.mid.g - palette.core.g) * localT;
      b = palette.core.b + (palette.mid.b - palette.core.b) * localT;
    } else {
      // Mid to edge transition
      const localT = (t - 0.4) / 0.6;
      r = palette.mid.r + (palette.edge.r - palette.mid.r) * localT;
      g = palette.mid.g + (palette.edge.g - palette.mid.g) * localT;
      b = palette.mid.b + (palette.edge.b - palette.mid.b) * localT;
    }

    // Boost brightness in denser regions
    const brightnessBoost = 1 + density * 0.3;
    return {
      r: Math.min(255, r * brightnessBoost),
      g: Math.min(255, g * brightnessBoost),
      b: Math.min(255, b * brightnessBoost),
    };
  }

  private drawEmbeddedStars(
    ctx: CanvasRenderingContext2D,
    cloud: NebulaCloud,
    centerX: number,
    centerY: number,
    radius: number,
    baseAlpha: number
  ) {
    // Add 2-4 bright spots within the nebula
    const starCount = 2 + Math.floor(cloud.seedOffset % 3);

    for (let i = 0; i < starCount; i++) {
      // Position based on seed for consistency
      const angle = (cloud.seedOffset * (i + 1) * 0.1) % (Math.PI * 2);
      const dist = 0.2 + ((cloud.seedOffset * (i + 1) * 0.3) % 0.4);

      const x = centerX + Math.cos(angle) * radius * dist;
      const y = centerY + Math.sin(angle) * radius * dist;

      // Pulsing brightness
      const pulse = 0.7 + 0.3 * Math.sin(cloud.phase * 2 + i);
      const starRadius = 4 + i * 2;
      const alpha = baseAlpha * 3 * pulse;

      // Bright core
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, starRadius * 3);
      gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
      gradient.addColorStop(0.2, `rgba(${cloud.palette.core.r}, ${cloud.palette.core.g}, ${cloud.palette.core.b}, ${alpha * 0.6})`);
      gradient.addColorStop(1, "transparent");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, starRadius * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  handleResize(dim: Dimensions) {
    this.dimensions = dim;
  }

  cleanup() {
    this.clouds = [];
    this.time = 0;
  }
}
