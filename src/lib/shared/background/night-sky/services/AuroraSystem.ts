import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";

// ============================================================================
// AURORA SYSTEM - Shimmering Curtains of Light (2036 Vision)
// ============================================================================
// Real auroras are vertical columns of light that:
// - Stay mostly upright (not swinging like tentacles)
// - Have horizontal waves of intensity rippling through
// - Fold and curve gently as curtains
// - Shimmer with varying brightness along their height
// ============================================================================

interface AuroraCurtain {
  // Horizontal position and shape
  startX: number; // Left edge (0-1 fraction)
  endX: number; // Right edge (0-1 fraction)

  // Vertical extent
  topY: number; // Top of curtain (0-1, usually near 0)
  bottomY: number; // Bottom of curtain (0-1, usually 0.7-0.9)

  // Animation phases
  wavePhase: number; // Horizontal wave propagation
  foldPhase: number; // Curtain folding animation
  shimmerSeed: number; // Random seed for shimmer pattern

  // Appearance
  intensity: number; // Overall brightness
  foldAmplitude: number; // How much the curtain folds

  // Per-ray variation seeds
  rayHeightVariation: number; // Seed for ray height randomization
  rayWidthVariation: number; // Seed for ray width randomization
}

// Aurora colors - atmospheric emission heights
const AURORA_COLORS = {
  green: { r: 120, g: 255, b: 160 }, // Oxygen at ~100km (dominant)
  teal: { r: 80, g: 220, b: 180 }, // Lower edge
  red: { r: 255, g: 100, b: 140 }, // Oxygen at ~200km+ (top)
  purple: { r: 200, g: 120, b: 255 }, // Nitrogen (edges)
};

export class AuroraSystem {
  private curtains: AuroraCurtain[] = [];
  private dimensions: Dimensions = { width: 0, height: 0 };
  private quality: QualityLevel = "high";
  private isEnabled: boolean = false;
  private isActive: boolean = true;

  // Animation
  private time: number = 0;

  // Offscreen canvas for performance
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;
  private needsRedraw: boolean = true;
  private lastRedrawTime: number = 0;
  private readonly REDRAW_INTERVAL = 33; // ~30fps

  // Quality settings
  private readonly QUALITY_CONFIG = {
    high: { curtainCount: 3, rayDensity: 40, enabled: true },
    medium: { curtainCount: 2, rayDensity: 25, enabled: true },
    low: { curtainCount: 1, rayDensity: 15, enabled: true },
    minimal: { curtainCount: 0, rayDensity: 0, enabled: false },
    "ultra-minimal": { curtainCount: 0, rayDensity: 0, enabled: false },
  };

  initialize(dim: Dimensions, quality: QualityLevel) {
    this.dimensions = dim;
    this.quality = quality;

    const config = this.QUALITY_CONFIG[quality];
    this.isEnabled = config.enabled;

    if (!this.isEnabled) {
      this.cleanup();
      return;
    }

    // Create offscreen canvas
    this.offscreenCanvas = document.createElement("canvas");
    this.offscreenCanvas.width = dim.width;
    this.offscreenCanvas.height = dim.height;
    this.offscreenCtx = this.offscreenCanvas.getContext("2d");

    // Generate curtains spanning the sky
    this.curtains = [];
    for (let i = 0; i < config.curtainCount; i++) {
      this.curtains.push(this.generateCurtain(i, config.curtainCount));
    }

    this.needsRedraw = true;
  }

  private generateCurtain(index: number, total: number): AuroraCurtain {
    // Distribute curtains across the sky with some overlap
    const sectionWidth = 1.0 / total;
    const baseX = index * sectionWidth;

    // Each curtain spans 40-60% of a section, with random positioning
    const curtainWidth = 0.25 + Math.random() * 0.2;
    const offsetX = Math.random() * (sectionWidth - curtainWidth * 0.5);

    return {
      startX: Math.max(0, baseX + offsetX - 0.05),
      endX: Math.min(1, baseX + offsetX + curtainWidth + 0.05),
      topY: 0.02 + Math.random() * 0.08, // Start near top
      bottomY: 0.7 + Math.random() * 0.2, // Extend toward horizon
      wavePhase: Math.random() * Math.PI * 2,
      foldPhase: Math.random() * Math.PI * 2,
      shimmerSeed: Math.random() * 1000,
      intensity: 0.6 + Math.random() * 0.4,
      foldAmplitude: 0.02 + Math.random() * 0.03, // Subtle folding
      rayHeightVariation: Math.random() * 1000, // For organic ray heights
      rayWidthVariation: Math.random() * 1000, // For natural width variation
    };
  }

  update(a11y: AccessibilitySettings, frameMultiplier: number = 1.0) {
    if (!this.isEnabled || !this.isActive) return;

    const speedMult = a11y.reducedMotion ? 0.2 : 1.0;
    this.time += 0.016 * frameMultiplier * speedMult;

    // Update curtain animations
    for (const curtain of this.curtains) {
      // Horizontal wave propagation (slower = more ethereal/majestic)
      curtain.wavePhase += 0.004 * frameMultiplier * speedMult;
      // Curtain folding (very slow, dreamlike)
      curtain.foldPhase += 0.0015 * frameMultiplier * speedMult;
    }

    // Mark for redraw
    const now = performance.now();
    if (now - this.lastRedrawTime > this.REDRAW_INTERVAL) {
      this.needsRedraw = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings) {
    if (!this.isEnabled || !this.isActive || !this.offscreenCanvas || !this.offscreenCtx) return;

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

    const config = this.QUALITY_CONFIG[this.quality];

    // Draw each curtain
    for (const curtain of this.curtains) {
      this.drawCurtain(ctx, curtain, config.rayDensity, a11y);
    }
  }

  private drawCurtain(
    ctx: CanvasRenderingContext2D,
    curtain: AuroraCurtain,
    rayDensity: number,
    a11y: AccessibilitySettings
  ) {
    const { width, height } = this.dimensions;
    // Reduced opacity for more atmospheric, less attention-grabbing effect
    const baseAlpha = (a11y.reducedMotion ? 0.08 : 0.12) * curtain.intensity;

    const curtainLeft = curtain.startX * width;
    const curtainRight = curtain.endX * width;
    const curtainWidth = curtainRight - curtainLeft;

    const baseTopY = curtain.topY * height;
    const baseBottomY = curtain.bottomY * height;

    // Draw vertical rays across the curtain width
    const raySpacing = curtainWidth / rayDensity;

    for (let i = 0; i < rayDensity; i++) {
      const progress = i / rayDensity; // 0 to 1 across curtain

      // Base X position
      let rayX = curtainLeft + progress * curtainWidth;

      // Add gentle folding (sine wave distortion)
      const foldOffset = Math.sin(progress * Math.PI * 3 + curtain.foldPhase)
                        * curtain.foldAmplitude * width;
      rayX += foldOffset;

      // === SOFT HORIZONTAL EDGES ===
      // Rays near edges fade out smoothly
      const edgeDistance = Math.min(progress, 1 - progress) * 2; // 0 at edges, 1 in middle
      const edgeFalloff = Math.pow(Math.min(1, edgeDistance * 2), 0.7); // Smooth easing

      // === RAY HEIGHT VARIATION ===
      // Each ray has slightly different top/bottom for organic silhouette
      const heightNoise1 = Math.sin(i * 3.7 + curtain.rayHeightVariation);
      const heightNoise2 = Math.sin(i * 7.3 + curtain.rayHeightVariation * 0.5);
      const topVariation = heightNoise1 * 0.03 * height; // ±3% height variation at top
      const bottomVariation = heightNoise2 * 0.05 * height; // ±5% at bottom
      const rayTopY = baseTopY + topVariation;
      const rayBottomY = baseBottomY + bottomVariation;

      // === RAY WIDTH VARIATION ===
      const widthNoise = 0.7 + 0.6 * Math.sin(i * 5.1 + curtain.rayWidthVariation);

      // Calculate ray intensity with horizontal wave
      // Waves of brightness travel horizontally through the curtain
      const waveIntensity = 0.4 + 0.6 * (
        0.5 + 0.5 * Math.sin(progress * Math.PI * 4 + curtain.wavePhase)
      );

      // Add shimmer variation (slower shimmer)
      const shimmer = 0.7 + 0.3 * Math.sin(
        progress * 17 + curtain.shimmerSeed + this.time * 1.5
      );

      // Combine all intensity factors
      const rayAlpha = baseAlpha * waveIntensity * shimmer * edgeFalloff;
      const rayWidth = raySpacing * (1.0 + 0.5 * waveIntensity) * widthNoise;

      // Draw the vertical ray with color gradient
      this.drawRay(ctx, rayX, rayTopY, rayBottomY, rayWidth, rayAlpha);
    }

    // === HORIZON GLOW ===
    // Subtle atmospheric glow at the bottom of the aurora
    this.drawHorizonGlow(ctx, curtainLeft, curtainRight, baseBottomY, baseAlpha * 0.4);
  }

  private drawHorizonGlow(
    ctx: CanvasRenderingContext2D,
    left: number,
    right: number,
    bottomY: number,
    alpha: number
  ) {
    const { height } = this.dimensions;
    const glowHeight = height * 0.08; // 8% of screen height

    const gradient = ctx.createLinearGradient(0, bottomY - glowHeight, 0, bottomY + glowHeight * 0.5);
    const { teal, green } = AURORA_COLORS;

    gradient.addColorStop(0, `rgba(${green.r}, ${green.g}, ${green.b}, 0)`);
    gradient.addColorStop(0.4, `rgba(${teal.r}, ${teal.g}, ${teal.b}, ${alpha * 0.3})`);
    gradient.addColorStop(0.7, `rgba(${teal.r}, ${teal.g}, ${teal.b}, ${alpha * 0.15})`);
    gradient.addColorStop(1, `rgba(${teal.r}, ${teal.g}, ${teal.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.fillRect(left, bottomY - glowHeight, right - left, glowHeight * 1.5);
  }

  private drawRay(
    ctx: CanvasRenderingContext2D,
    x: number,
    topY: number,
    bottomY: number,
    width: number,
    alpha: number
  ) {
    const height = bottomY - topY;

    // Create vertical gradient for the ray
    const gradient = ctx.createLinearGradient(x, topY, x, bottomY);

    const { red, purple, green, teal } = AURORA_COLORS;

    // Color bands based on atmospheric heights
    // Top: red/purple (high altitude oxygen/nitrogen)
    // Middle: bright green (main oxygen emission)
    // Bottom: teal fading out
    gradient.addColorStop(0, `rgba(${red.r}, ${red.g}, ${red.b}, ${alpha * 0.3})`);
    gradient.addColorStop(0.15, `rgba(${purple.r}, ${purple.g}, ${purple.b}, ${alpha * 0.5})`);
    gradient.addColorStop(0.3, `rgba(${green.r}, ${green.g}, ${green.b}, ${alpha * 0.9})`);
    gradient.addColorStop(0.5, `rgba(${green.r}, ${green.g}, ${green.b}, ${alpha})`);
    gradient.addColorStop(0.7, `rgba(${teal.r}, ${teal.g}, ${teal.b}, ${alpha * 0.7})`);
    gradient.addColorStop(1, `rgba(${teal.r}, ${teal.g}, ${teal.b}, ${alpha * 0.1})`);

    // Draw as a soft vertical band
    ctx.fillStyle = gradient;

    // Use a rounded rectangle for softer edges
    const halfWidth = width / 2;
    ctx.beginPath();
    ctx.moveTo(x - halfWidth, topY);
    ctx.lineTo(x + halfWidth, topY);
    ctx.lineTo(x + halfWidth, bottomY);
    ctx.lineTo(x - halfWidth, bottomY);
    ctx.closePath();
    ctx.fill();

    // Add a brighter core
    const coreGradient = ctx.createLinearGradient(x, topY, x, bottomY);
    coreGradient.addColorStop(0, `rgba(${green.r}, ${green.g}, ${green.b}, 0)`);
    coreGradient.addColorStop(0.35, `rgba(255, 255, 255, ${alpha * 0.15})`);
    coreGradient.addColorStop(0.5, `rgba(255, 255, 255, ${alpha * 0.2})`);
    coreGradient.addColorStop(0.65, `rgba(${green.r}, ${green.g}, ${green.b}, ${alpha * 0.1})`);
    coreGradient.addColorStop(1, `rgba(${teal.r}, ${teal.g}, ${teal.b}, 0)`);

    ctx.fillStyle = coreGradient;
    const coreWidth = width * 0.3;
    ctx.fillRect(x - coreWidth / 2, topY, coreWidth, height);
  }

  setActive(active: boolean) {
    this.isActive = active;
    if (active) {
      this.needsRedraw = true;
    }
  }

  handleResize(dim: Dimensions) {
    if (!this.isEnabled) return;

    this.dimensions = dim;

    if (this.offscreenCanvas) {
      this.offscreenCanvas.width = dim.width;
      this.offscreenCanvas.height = dim.height;
      this.offscreenCtx = this.offscreenCanvas.getContext("2d");
    }

    this.needsRedraw = true;
  }

  cleanup() {
    this.curtains = [];
    this.offscreenCanvas = null;
    this.offscreenCtx = null;
    this.time = 0;
  }
}
