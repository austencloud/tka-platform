import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";

// ============================================================================
// PROCEDURAL NEBULA SYSTEM (Optimized with Offscreen Canvas Caching)
// ============================================================================
// Renders nebula to offscreen canvas, then blits to main canvas each frame.
// Offscreen canvas only updates every ~200ms for subtle animation.
// ============================================================================

interface NebulaCloud {
  centerX: number;
  centerY: number;
  radiusFraction: number;
  palette: NebulaColorPalette;
  seedOffset: number;
  phase: number;
  rotation: number;
}

interface NebulaColorPalette {
  core: { r: number; g: number; b: number };
  mid: { r: number; g: number; b: number };
  edge: { r: number; g: number; b: number };
}

const NEBULA_PALETTES: NebulaColorPalette[] = [
  // Orion-like (pink/magenta)
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
];

export class ProceduralNebulaSystem {
  private clouds: NebulaCloud[] = [];
  private dimensions: Dimensions = { width: 0, height: 0 };
  private quality: QualityLevel = "high";
  private isEnabled: boolean = false;

  // Offscreen canvas caching for performance
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private needsRedraw: boolean = true;
  private lastRedrawTime: number = 0;
  private readonly REDRAW_INTERVAL = 250; // ms between offscreen redraws

  // Animation
  private time: number = 0;

  // Quality settings - resolution is step size (larger = fewer samples = faster)
  private readonly QUALITY_CONFIG = {
    high: { cloudCount: 2, resolution: 16, layers: 3 },
    medium: { cloudCount: 1, resolution: 20, layers: 2 },
    low: { cloudCount: 1, resolution: 24, layers: 2 },
    minimal: { cloudCount: 0, resolution: 0, layers: 0 },
    "ultra-minimal": { cloudCount: 0, resolution: 0, layers: 0 },
  };

  private noise(x: number, y: number, seed: number): number {
    const s = seed * 0.1;
    const n1 = Math.sin(x * 1.0 + y * 0.5 + s) * Math.cos(y * 0.8 - x * 0.3 + s);
    const n2 = Math.sin(x * 2.1 - y * 1.3 + s * 1.3) * Math.cos(y * 1.7 + x * 0.9 + s) * 0.5;
    const n3 = Math.sin(x * 4.3 + y * 3.7 + s * 0.7) * Math.cos(y * 2.9 - x * 2.1 + s) * 0.25;
    return (n1 + n2 + n3) / 1.75;
  }

  private fbm(x: number, y: number, seed: number, octaves: number): number {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;

    for (let i = 0; i < octaves; i++) {
      value += amplitude * this.noise(x * frequency, y * frequency, seed + i * 10);
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
      this.offscreenCanvas = null;
      this.offscreenCtx = null;
      return;
    }

    // Create offscreen canvas
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = dim.width;
    this.offscreenCanvas.height = dim.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    // Generate clouds
    this.clouds = [];
    for (let i = 0; i < config.cloudCount; i++) {
      this.clouds.push(this.generateCloud(i, config.cloudCount));
    }

    this.needsRedraw = true;
    this.lastRedrawTime = 0;
  }

  private generateCloud(index: number, total: number): NebulaCloud {
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.5;
    const distance = 0.25 + Math.random() * 0.2;

    return {
      centerX: 0.5 + Math.cos(angle) * distance,
      centerY: 0.5 + Math.sin(angle) * distance,
      radiusFraction: 0.18 + Math.random() * 0.1,
      palette: NEBULA_PALETTES[index % NEBULA_PALETTES.length]!,
      seedOffset: Math.random() * 1000,
      phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
    };
  }

  update(a11y: AccessibilitySettings, frameMultiplier: number = 1.0) {
    if (!this.isEnabled) return;

    const speed = a11y.reducedMotion ? 0.0002 : 0.001;
    this.time += speed * frameMultiplier;

    for (const cloud of this.clouds) {
      cloud.phase += 0.002 * frameMultiplier * (a11y.reducedMotion ? 0.2 : 1);
    }

    // Mark for redraw periodically
    const now = performance.now();
    if (now - this.lastRedrawTime > this.REDRAW_INTERVAL) {
      this.needsRedraw = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings) {
    if (!this.isEnabled || !this.offscreenCanvas || !this.offscreenCtx) return;

    // Redraw offscreen canvas if needed (throttled for performance)
    if (this.needsRedraw) {
      this.renderToOffscreen(a11y);
      this.needsRedraw = false;
      this.lastRedrawTime = performance.now();
    }

    // Fast: just blit the cached canvas
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(this.offscreenCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  private renderToOffscreen(a11y: AccessibilitySettings) {
    const ctx = this.offscreenCtx;
    if (!ctx) return;

    const config = this.QUALITY_CONFIG[this.quality];
    const { width, height } = this.dimensions;
    const diagonal = Math.sqrt(width * width + height * height);

    ctx.clearRect(0, 0, width, height);

    for (const cloud of this.clouds) {
      this.renderCloud(ctx, cloud, diagonal, config, a11y);
    }
  }

  private renderCloud(
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

    const step = config.resolution;
    const pulse = 0.85 + 0.15 * Math.sin(cloud.phase);
    const baseAlpha = (a11y.reducedMotion ? 0.05 : 0.08) * pulse;

    const startX = Math.max(0, centerX - radius);
    const endX = Math.min(width, centerX + radius);
    const startY = Math.max(0, centerY - radius);
    const endY = Math.min(height, centerY + radius);

    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const dx = (x - centerX) / radius;
        const dy = (y - centerY) / radius;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 1.1) continue;

        const rotX = dx * Math.cos(cloud.rotation) - dy * Math.sin(cloud.rotation);
        const rotY = dx * Math.sin(cloud.rotation) + dy * Math.cos(cloud.rotation);

        const noiseX = rotX * 2.5 + this.time;
        const noiseY = rotY * 2.5;
        const density = this.fbm(noiseX, noiseY, cloud.seedOffset, config.layers);

        const falloff = 1 - Math.pow(dist, 1.2);
        const cloudDensity = Math.max(0, (density * 0.5 + 0.5) * falloff);

        if (cloudDensity < 0.15) continue;

        const color = this.getColor(cloud.palette, dist);
        const alpha = cloudDensity * baseAlpha;

        // Draw larger, softer blobs (fewer but bigger)
        const blobRadius = step * 1.5;
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, blobRadius);
        gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
        gradient.addColorStop(0.5, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.4})`);
        gradient.addColorStop(1, "transparent");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, blobRadius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  private getColor(palette: NebulaColorPalette, distance: number): { r: number; g: number; b: number } {
    const t = Math.min(1, distance);

    if (t < 0.4) {
      const localT = t / 0.4;
      return {
        r: palette.core.r + (palette.mid.r - palette.core.r) * localT,
        g: palette.core.g + (palette.mid.g - palette.core.g) * localT,
        b: palette.core.b + (palette.mid.b - palette.core.b) * localT,
      };
    } else {
      const localT = (t - 0.4) / 0.6;
      return {
        r: palette.mid.r + (palette.edge.r - palette.mid.r) * localT,
        g: palette.mid.g + (palette.edge.g - palette.mid.g) * localT,
        b: palette.mid.b + (palette.edge.b - palette.mid.b) * localT,
      };
    }
  }

  handleResize(dim: Dimensions) {
    if (!this.isEnabled) return;

    this.dimensions = dim;

    // Recreate offscreen canvas at new size
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = dim.width;
      this.offscreenCanvas.height = dim.height;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }

    this.needsRedraw = true;
  }

  cleanup() {
    this.clouds = [];
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.time = 0;
  }
}
