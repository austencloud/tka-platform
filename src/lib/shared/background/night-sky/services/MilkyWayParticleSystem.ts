import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";

// ============================================================================
// MILKY WAY PARTICLE SYSTEM (2036 Vision)
// ============================================================================
// A living river of light - thousands of soft particles creating an organic,
// breathing band across the night sky. No more gradient rectangles or banding.
//
// Key features:
// - Curved band path (bezier)
// - Noise-based density variation (dark lanes, bright knots)
// - Position-based coloring (warm core, cool edges)
// - Subtle breathing and shimmer animation
// - Offscreen canvas caching for performance
// ============================================================================

interface MilkyWayParticle {
  // Position along band (0-1)
  t: number;
  // Perpendicular offset from center (-1 to 1)
  offset: number;
  // Cached screen position
  x: number;
  y: number;
  // Appearance
  size: number;
  baseAlpha: number;
  // Animation
  shimmerPhase: number;
  shimmerSpeed: number;
  // Color temperature (0 = warm core, 1 = cool edge)
  temperature: number;
  // Is this a "bright" accent particle?
  isBright: boolean;
}

// Color palette
const COLORS = {
  warmCore: { r: 255, g: 248, b: 235 }, // Cream/gold
  neutral: { r: 245, g: 248, b: 255 }, // White
  coolEdge: { r: 200, g: 220, b: 255 }, // Blue-white
};

export class MilkyWayParticleSystem {
  private particles: MilkyWayParticle[] = [];
  private dimensions: Dimensions = { width: 0, height: 0 };
  private quality: QualityLevel = "high";
  private isEnabled: boolean = false;

  // Band path control points (normalized 0-1)
  private bandStart = { x: -0.1, y: 1.1 }; // Bottom-left (off screen)
  private bandEnd = { x: 1.1, y: -0.1 }; // Top-right (off screen)
  private bandControl1 = { x: 0.3, y: 0.7 }; // Control point 1
  private bandControl2 = { x: 0.7, y: 0.3 }; // Control point 2

  // Animation state
  private time: number = 0;
  private breathingPhase: number = 0;

  // Offscreen canvas
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private needsRedraw: boolean = true;
  private lastRedrawTime: number = 0;
  private readonly REDRAW_INTERVAL = 120; // ms - slower than aurora

  // Quality settings
  private readonly QUALITY_CONFIG = {
    high: { particleCount: 800, hasDarkLanes: true, hasBrightKnots: true },
    medium: { particleCount: 450, hasDarkLanes: true, hasBrightKnots: false },
    low: { particleCount: 250, hasDarkLanes: false, hasBrightKnots: false },
    minimal: { particleCount: 0, hasDarkLanes: false, hasBrightKnots: false },
    "ultra-minimal": { particleCount: 0, hasDarkLanes: false, hasBrightKnots: false },
  };

  // Noise seeds for consistent patterns
  private noiseSeed: number = Math.random() * 1000;
  private darkLaneSeed: number = Math.random() * 1000;

  initialize(dim: Dimensions, quality: QualityLevel) {
    this.dimensions = dim;
    this.quality = quality;

    const config = this.QUALITY_CONFIG[quality];
    this.isEnabled = config.particleCount > 0;

    if (!this.isEnabled) {
      this.cleanup();
      return;
    }

    // Create offscreen canvas
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = dim.width;
    this.offscreenCanvas.height = dim.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    // Generate particles
    this.generateParticles(config);

    this.needsRedraw = true;
  }

  private generateParticles(config: { particleCount: number; hasDarkLanes: boolean; hasBrightKnots: boolean }) {
    this.particles = [];
    const { width, height } = this.dimensions;

    // Generate more candidates than needed, reject based on density
    const candidates = config.particleCount * 3;
    let placed = 0;

    for (let i = 0; i < candidates && placed < config.particleCount; i++) {
      // Random position along band
      const t = Math.random();

      // Random perpendicular offset (Gaussian-ish distribution)
      const u1 = Math.random();
      const u2 = Math.random();
      const gaussian = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const offset = Math.max(-1, Math.min(1, gaussian * 0.35)); // Clamp to [-1, 1]

      // Get screen position
      const bandWidth = this.getBandWidth(t);
      const bandPos = this.getBandPosition(t);
      const perpendicular = this.getBandPerpendicular(t);

      const x = bandPos.x * width + perpendicular.x * offset * bandWidth * width;
      const y = bandPos.y * height + perpendicular.y * offset * bandWidth * height;

      // Skip if off screen
      if (x < -50 || x > width + 50 || y < -50 || y > height + 50) continue;

      // Calculate density at this position
      const density = this.calculateDensity(t, offset, config);

      // Rejection sampling - skip if random > density
      if (Math.random() > density) continue;

      // Determine if this is a bright accent particle
      const isBright = Math.random() < 0.3;

      // Temperature based on offset (0 at center = warm, 1 at edge = cool)
      const temperature = Math.abs(offset);

      this.particles.push({
        t,
        offset,
        x,
        y,
        size: isBright ? 1.5 + Math.random() * 2.5 : 0.8 + Math.random() * 1.2,
        baseAlpha: isBright ? 0.06 + Math.random() * 0.06 : 0.02 + Math.random() * 0.03,
        shimmerPhase: Math.random() * Math.PI * 2,
        shimmerSpeed: 0.5 + Math.random() * 1.0,
        temperature,
        isBright,
      });

      placed++;
    }
  }

  private calculateDensity(t: number, offset: number, config: { hasDarkLanes: boolean; hasBrightKnots: boolean }): number {
    // Base density: Gaussian across width, slightly higher in middle of band
    const crossDensity = Math.exp(-offset * offset * 2); // Gaussian across width
    const alongDensity = 0.7 + 0.3 * Math.sin(t * Math.PI); // Slightly denser in middle
    let density = crossDensity * alongDensity;

    // Dark lanes (stretched noise creating elongated gaps)
    if (config.hasDarkLanes) {
      const darkLaneNoise = this.noise2D(t * 3 + this.darkLaneSeed, offset * 8);
      if (darkLaneNoise > 0.6) {
        density *= 0.1; // Strong reduction in dark lanes
      } else if (darkLaneNoise > 0.4) {
        density *= 0.5; // Partial reduction near dark lanes
      }
    }

    // Bright knots (small regions of increased density)
    if (config.hasBrightKnots) {
      const knotNoise = this.noise2D(t * 8 + this.noiseSeed, offset * 4);
      if (knotNoise > 0.7) {
        density *= 1.8; // Increased density in knots
      }
    }

    // General noise variation
    const variation = 0.7 + 0.6 * this.noise2D(t * 5 + this.noiseSeed * 0.5, offset * 3);
    density *= variation;

    return Math.min(1, density);
  }

  // Simple 2D noise function (layered sine waves approximating Perlin)
  private noise2D(x: number, y: number): number {
    const n1 = Math.sin(x * 1.0 + y * 0.7) * Math.cos(y * 1.2 - x * 0.5);
    const n2 = Math.sin(x * 2.3 - y * 1.8) * Math.cos(y * 2.1 + x * 1.3) * 0.5;
    const n3 = Math.sin(x * 4.1 + y * 3.7) * Math.cos(y * 3.9 - x * 2.8) * 0.25;
    return (n1 + n2 + n3 + 1.75) / 3.5; // Normalize to 0-1
  }

  // Cubic bezier for band path
  private getBandPosition(t: number): { x: number; y: number } {
    const mt = 1 - t;
    const mt2 = mt * mt;
    const mt3 = mt2 * mt;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: mt3 * this.bandStart.x + 3 * mt2 * t * this.bandControl1.x +
         3 * mt * t2 * this.bandControl2.x + t3 * this.bandEnd.x,
      y: mt3 * this.bandStart.y + 3 * mt2 * t * this.bandControl1.y +
         3 * mt * t2 * this.bandControl2.y + t3 * this.bandEnd.y,
    };
  }

  // Get perpendicular direction to band at position t
  private getBandPerpendicular(t: number): { x: number; y: number } {
    const delta = 0.01;
    const p1 = this.getBandPosition(Math.max(0, t - delta));
    const p2 = this.getBandPosition(Math.min(1, t + delta));

    // Tangent direction
    const tx = p2.x - p1.x;
    const ty = p2.y - p1.y;
    const len = Math.sqrt(tx * tx + ty * ty);

    // Perpendicular (rotate 90 degrees)
    return { x: -ty / len, y: tx / len };
  }

  // Band width varies along path (wider in middle)
  private getBandWidth(t: number): number {
    const baseWidth = 0.12; // 12% of screen
    const variation = Math.sin(t * Math.PI); // 0 at ends, 1 in middle
    return baseWidth * (0.4 + 0.6 * variation);
  }

  update(a11y: AccessibilitySettings, frameMultiplier: number = 1.0) {
    if (!this.isEnabled) return;

    const speedMult = a11y.reducedMotion ? 0.2 : 1.0;
    this.time += 0.016 * frameMultiplier * speedMult;

    // Global breathing (slow intensity pulse)
    this.breathingPhase += 0.0008 * frameMultiplier * speedMult; // ~8 second period

    // Update particle shimmer phases
    for (const p of this.particles) {
      p.shimmerPhase += 0.02 * p.shimmerSpeed * frameMultiplier * speedMult;
    }

    // Mark for redraw periodically
    const now = performance.now();
    if (now - this.lastRedrawTime > this.REDRAW_INTERVAL) {
      this.needsRedraw = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings) {
    if (!this.isEnabled || !this.offscreenCanvas || !this.offscreenCtx) return;

    if (this.needsRedraw) {
      this.renderToOffscreen(a11y);
      this.needsRedraw = false;
      this.lastRedrawTime = performance.now();
    }

    // Blit with additive blending
    ctx.globalCompositeOperation = "screen";
    ctx.drawImage(this.offscreenCanvas, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  private renderToOffscreen(a11y: AccessibilitySettings) {
    const ctx = this.offscreenCtx;
    if (!ctx) return;

    const { width, height } = this.dimensions;
    ctx.clearRect(0, 0, width, height);

    // Global breathing intensity
    const breathingMult = 0.9 + 0.1 * Math.sin(this.breathingPhase);
    const baseIntensity = (a11y.reducedMotion ? 0.7 : 1.0) * breathingMult;

    // Draw all particles
    for (const p of this.particles) {
      this.drawParticle(ctx, p, baseIntensity);
    }
  }

  private drawParticle(ctx: CanvasRenderingContext2D, p: MilkyWayParticle, baseIntensity: number) {
    // Individual shimmer
    const shimmer = 0.85 + 0.15 * Math.sin(p.shimmerPhase);
    const alpha = p.baseAlpha * baseIntensity * shimmer;

    // Color based on temperature (position across band width)
    const color = this.getParticleColor(p.temperature);

    // Draw soft circular gradient
    const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
    gradient.addColorStop(0, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`);
    gradient.addColorStop(0.4, `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha * 0.5})`);
    gradient.addColorStop(1, `rgba(${color.r}, ${color.g}, ${color.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }

  private getParticleColor(temperature: number): { r: number; g: number; b: number } {
    // temperature: 0 = center (warm), 1 = edge (cool)
    const t = Math.min(1, temperature);

    if (t < 0.4) {
      // Warm core to neutral
      const localT = t / 0.4;
      return {
        r: COLORS.warmCore.r + (COLORS.neutral.r - COLORS.warmCore.r) * localT,
        g: COLORS.warmCore.g + (COLORS.neutral.g - COLORS.warmCore.g) * localT,
        b: COLORS.warmCore.b + (COLORS.neutral.b - COLORS.warmCore.b) * localT,
      };
    } else {
      // Neutral to cool edge
      const localT = (t - 0.4) / 0.6;
      return {
        r: COLORS.neutral.r + (COLORS.coolEdge.r - COLORS.neutral.r) * localT,
        g: COLORS.neutral.g + (COLORS.coolEdge.g - COLORS.neutral.g) * localT,
        b: COLORS.neutral.b + (COLORS.coolEdge.b - COLORS.neutral.b) * localT,
      };
    }
  }

  handleResize(dim: Dimensions) {
    if (!this.isEnabled) return;

    const oldDim = this.dimensions;
    this.dimensions = dim;

    // Resize offscreen canvas
    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = dim.width;
      this.offscreenCanvas.height = dim.height;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }

    // Recalculate particle screen positions
    for (const p of this.particles) {
      const bandWidth = this.getBandWidth(p.t);
      const bandPos = this.getBandPosition(p.t);
      const perpendicular = this.getBandPerpendicular(p.t);

      p.x = bandPos.x * dim.width + perpendicular.x * p.offset * bandWidth * dim.width;
      p.y = bandPos.y * dim.height + perpendicular.y * p.offset * bandWidth * dim.height;
    }

    this.needsRedraw = true;
  }

  cleanup() {
    this.particles = [];
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.time = 0;
    this.breathingPhase = 0;
  }
}
