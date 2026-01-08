import type {
  AccessibilitySettings,
  QualitySettings,
} from "$lib/shared/background/shared/domain/models/background-models";
import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  ParallaxConfig,
  ParallaxLayer,
  Star,
  StarConfig,
} from "../domain/models/night-sky-models";
// Removed resolve import - calculation service now injected via constructor
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";

// ============================================================================
// DIFFRACTION STAR - Enhanced brightest stars with camera-like diffraction spikes
// ============================================================================
interface DiffractionStar {
  star: Star;
  spikePhase: number; // Rotation/pulse animation phase
  chromaOffset: number; // Chromatic aberration offset
}

export class ParallaxStarSystem {
  private layers: Record<"far" | "mid" | "near", ParallaxLayer> = {
    far: { stars: [], driftX: 0, driftY: 0 },
    mid: { stars: [], driftX: 0, driftY: 0 },
    near: { stars: [], driftX: 0, driftY: 0 },
  };

  // Track brightest stars for diffraction spike rendering
  private diffractionStars: DiffractionStar[] = [];
  private readonly DIFFRACTION_STAR_COUNT = 8; // Top 8 brightest stars get spikes
  private readonly DIFFRACTION_SPIKE_COUNT = 6; // 6-pointed diffraction pattern

  private config: ParallaxConfig;
  private starConfig: StarConfig;
  private qualitySettings: QualitySettings;
  private lastDimensions: Dimensions | null = null;
  private calculationService: INightSkyCalculationService;

  constructor(
    config: ParallaxConfig,
    starConfig: StarConfig,
    qualitySettings: QualitySettings,
    calculationService: INightSkyCalculationService
  ) {
    this.config = config;
    this.starConfig = starConfig;
    this.qualitySettings = qualitySettings;
    this.calculationService = calculationService;
  }

  initialize(dim: Dimensions, a11y: AccessibilitySettings) {
    const mkLayer = (key: "far" | "mid" | "near"): ParallaxLayer => {
      const pCfg = this.config[key];
      const density = pCfg.density * this.qualitySettings.densityMultiplier;
      const count = Math.floor(dim.width * dim.height * density);
      const stars: Star[] = Array.from({ length: count }).map(() => {
        const star = this.calculationService.makeStar(
          dim,
          this.starConfig,
          a11y
        );

        // Apply Internet Consensus 3-Layer Classic approach (2023-2025)
        // Size: Fixed per layer (1px/2px/3px)
        // Opacity: Graduated (0.4/0.6/0.8)
        // Sparkles: Minimal (0%/5%/5%)

        if (key === "far") {
          // Far layer: 1px, 0.4 opacity, no sparkles
          star.radius = pCfg.sizeMultiplier;
          star.baseOpacity = star.baseOpacity * pCfg.opacityMultiplier;
          star.isSparkle = false; // No sparkles on distant stars
        } else if (key === "mid") {
          // Mid layer: 2px, 0.6 opacity, 5% sparkles
          star.radius = pCfg.sizeMultiplier;
          star.baseOpacity = star.baseOpacity * pCfg.opacityMultiplier;
          star.isSparkle = Math.random() < pCfg.sparkleChance;
        } else {
          // Near layer: 3px, 0.8 opacity, 5% sparkles
          star.radius = pCfg.sizeMultiplier;
          star.baseOpacity = star.baseOpacity * pCfg.opacityMultiplier;
          star.isSparkle = Math.random() < pCfg.sparkleChance;
        }

        return star;
      });
      return {
        stars,
        driftX: pCfg.drift * dim.width,
        driftY: pCfg.drift * dim.height,
      };
    };

    this.layers = {
      far: mkLayer("far"),
      mid: mkLayer("mid"),
      near: mkLayer("near"),
    };

    // Pre-populate: Simulate animation already running
    // Randomize twinkle phases so stars appear mid-animation
    (["far", "mid", "near"] as Array<keyof typeof this.layers>).forEach(
      (key) => {
        const L = this.layers[key];
        L.stars.forEach((star: Star) => {
          // Random twinkle phase (0 to 2π)
          star.twinklePhase = Math.random() * Math.PI * 2;
          // Set current opacity based on random phase
          if (star.isTwinkling) {
            star.currentOpacity =
              star.baseOpacity * (0.7 + 0.3 * Math.sin(star.twinklePhase));
          } else {
            star.currentOpacity = star.baseOpacity;
          }
        });
      }
    );

    // Set lastDimensions so future updates can detect changes
    this.lastDimensions = dim;

    // Identify brightest stars for diffraction spike rendering (HIGH quality only)
    this.identifyDiffractionStars();
  }

  /**
   * Identify the brightest stars from the near layer for diffraction spike rendering.
   * These get special 6-pointed diffraction patterns like camera lens flares.
   */
  private identifyDiffractionStars() {
    // Only enable for high quality
    if (this.qualitySettings.densityMultiplier < 1) {
      this.diffractionStars = [];
      return;
    }

    // Get all near layer stars and sort by brightness (baseOpacity * radius)
    const nearStars = [...this.layers.near.stars];
    nearStars.sort((a, b) => {
      const brightnessA = a.baseOpacity * a.radius;
      const brightnessB = b.baseOpacity * b.radius;
      return brightnessB - brightnessA;
    });

    // Take the top N brightest stars
    const brightestStars = nearStars.slice(0, this.DIFFRACTION_STAR_COUNT);

    // Create diffraction star tracking objects
    this.diffractionStars = brightestStars.map((star) => ({
      star,
      spikePhase: Math.random() * Math.PI * 2,
      chromaOffset: Math.random() * 0.3, // Slight offset for chromatic variation
    }));
  }

  update(
    dim: Dimensions,
    a11y: AccessibilitySettings,
    frameMultiplier: number = 1.0
  ) {
    if (Object.keys(this.layers).length === 0) {
      this.initialize(dim, a11y);
      return;
    }

    // Handle dimension changes smoothly
    if (
      this.lastDimensions &&
      (dim.width !== this.lastDimensions.width ||
        dim.height !== this.lastDimensions.height)
    ) {
      this.adaptToNewDimensions(dim, a11y);
      this.lastDimensions = dim;
      return;
    }

    // Regular animation updates
    (["far", "mid", "near"] as Array<keyof typeof this.layers>).forEach(
      (key) => {
        const L = this.layers[key];
        // Update drift values for current dimensions
        const pCfg = this.config[key];
        L.driftX = pCfg.drift * dim.width;
        L.driftY = pCfg.drift * dim.height;

        L.stars.forEach((s: Star) => {
          // Apply frame multiplier to drift for consistent animation speed
          // 95% reduction for users with vestibular disorders (WCAG AAA)
          const effectiveDrift =
            frameMultiplier * (a11y.reducedMotion ? 0.05 : 1);
          s.x = (s.x + L.driftX * effectiveDrift + dim.width) % dim.width;
          s.y = (s.y + L.driftY * effectiveDrift + dim.height) % dim.height;

          if (s.isTwinkling) {
            // Apply frame multiplier to twinkle speed for consistent animation speed
            const effectiveTwinkleSpeed = s.twinkleSpeed * effectiveDrift;
            s.twinklePhase += effectiveTwinkleSpeed;
            s.currentOpacity =
              s.baseOpacity * (0.7 + 0.3 * Math.sin(s.twinklePhase));
          } else {
            s.currentOpacity = s.baseOpacity;
          }
        });
      }
    );

    // Update diffraction star phases (subtle rotation/pulse)
    const effectiveSpeed = frameMultiplier * (a11y.reducedMotion ? 0.2 : 1);
    for (const diffStar of this.diffractionStars) {
      diffStar.spikePhase += 0.001 * effectiveSpeed; // Very slow rotation
    }
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings) {
    if (Object.keys(this.layers).length === 0) return;

    (["far", "mid", "near"] as Array<keyof typeof this.layers>).forEach(
      (key) => {
        const L = this.layers[key];
        const alphaMult = key === "far" ? 0.5 : key === "mid" ? 0.8 : 1;
        L.stars.forEach((star: Star) => {
          ctx.globalAlpha =
            star.currentOpacity * alphaMult * (a11y.reducedMotion ? 0.7 : 1);
          ctx.fillStyle = star.color;

          // Draw sparkle shape for stars marked as sparkles
          if (star.isSparkle) {
            this.drawSparkle(ctx, star.x, star.y, star.radius);
          } else {
            // Regular circular stars
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
            ctx.fill();
          }
        });
      }
    );

    // Draw diffraction spikes on brightest stars (HIGH quality only)
    if (this.diffractionStars.length > 0) {
      this.drawDiffractionStars(ctx, a11y);
    }

    ctx.globalAlpha = 1;
  }

  /**
   * Draw diffraction spikes on the brightest stars.
   * Creates camera-like 6-pointed star patterns with chromatic aberration.
   */
  private drawDiffractionStars(
    ctx: CanvasRenderingContext2D,
    a11y: AccessibilitySettings
  ) {
    for (const diffStar of this.diffractionStars) {
      const star = diffStar.star;
      const phase = diffStar.spikePhase;
      const chromaOffset = diffStar.chromaOffset;

      // Spike length proportional to star brightness
      const brightness = star.currentOpacity;
      const spikeLength = star.radius * 8 * brightness;

      // Pulse effect on spike intensity
      const pulseIntensity = 0.7 + 0.3 * Math.sin(phase * 3);
      const baseAlpha = brightness * pulseIntensity * (a11y.reducedMotion ? 0.5 : 0.8);

      ctx.save();
      ctx.translate(star.x, star.y);
      // Very subtle rotation based on phase
      ctx.rotate(phase * 0.1);

      // Draw 6 spikes with chromatic aberration
      for (let i = 0; i < this.DIFFRACTION_SPIKE_COUNT; i++) {
        const angle = (i / this.DIFFRACTION_SPIKE_COUNT) * Math.PI * 2;

        // Draw chromatic aberration layers (subtle rainbow fringing)
        this.drawDiffractionSpike(ctx, angle, spikeLength, baseAlpha, chromaOffset);
      }

      // Draw central glow
      this.drawCentralGlow(ctx, star, baseAlpha);

      ctx.restore();
    }
  }

  /**
   * Draw a single diffraction spike with chromatic aberration.
   */
  private drawDiffractionSpike(
    ctx: CanvasRenderingContext2D,
    angle: number,
    length: number,
    alpha: number,
    chromaOffset: number
  ) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);

    // Main spike (white core)
    const gradient = ctx.createLinearGradient(
      0,
      0,
      cosA * length,
      sinA * length
    );
    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.3, `rgba(255, 255, 255, ${alpha * 0.5})`);
    gradient.addColorStop(1, "transparent");

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cosA * length, sinA * length);
    ctx.stroke();

    // Chromatic aberration - red shifted outward
    const redGradient = ctx.createLinearGradient(
      0,
      0,
      cosA * length * 1.1,
      sinA * length * 1.1
    );
    redGradient.addColorStop(0, "transparent");
    redGradient.addColorStop(0.5 + chromaOffset * 0.2, `rgba(255, 100, 100, ${alpha * 0.3})`);
    redGradient.addColorStop(1, "transparent");

    ctx.strokeStyle = redGradient;
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(cosA * length * 0.3, sinA * length * 0.3);
    ctx.lineTo(cosA * length * 1.1, sinA * length * 1.1);
    ctx.stroke();

    // Chromatic aberration - blue shifted inward
    const blueGradient = ctx.createLinearGradient(
      0,
      0,
      cosA * length * 0.9,
      sinA * length * 0.9
    );
    blueGradient.addColorStop(0, `rgba(100, 150, 255, ${alpha * 0.25})`);
    blueGradient.addColorStop(0.5, `rgba(100, 150, 255, ${alpha * 0.15})`);
    blueGradient.addColorStop(1, "transparent");

    ctx.strokeStyle = blueGradient;
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(cosA * length * 0.9, sinA * length * 0.9);
    ctx.stroke();
  }

  /**
   * Draw the central glow around a diffraction star.
   */
  private drawCentralGlow(
    ctx: CanvasRenderingContext2D,
    star: Star,
    alpha: number
  ) {
    const glowRadius = star.radius * 4;

    // Outer glow
    const outerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    outerGlow.addColorStop(0, `rgba(255, 255, 255, ${alpha * 0.8})`);
    outerGlow.addColorStop(0.2, `rgba(255, 255, 255, ${alpha * 0.4})`);
    outerGlow.addColorStop(0.5, `rgba(200, 220, 255, ${alpha * 0.15})`);
    outerGlow.addColorStop(1, "transparent");

    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bright core
    ctx.fillStyle = star.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(0, 0, star.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Draw a proper 5-pointed star with glow (like real stars)
   */
  private drawSparkle(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number
  ) {
    const outerRadius = radius * 2.5; // Outer points
    const innerRadius = radius * 1; // Inner points
    const spikes = 5;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 2); // Point upward

    // Save the original star color
    const starColor = ctx.fillStyle as string;

    // Draw glow first (behind the star)
    const glowGradient = ctx.createRadialGradient(
      0,
      0,
      0,
      0,
      0,
      outerRadius * 1.5
    );
    glowGradient.addColorStop(0, starColor);
    glowGradient.addColorStop(0.5, starColor + "40"); // 25% opacity
    glowGradient.addColorStop(1, "transparent");

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, outerRadius * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Draw the 5-pointed star
    ctx.fillStyle = starColor; // Reset to original color
    ctx.beginPath();

    for (let i = 0; i < spikes * 2; i++) {
      const angle = (i * Math.PI) / spikes;
      const r = i % 2 === 0 ? outerRadius : innerRadius;
      const pointX = r * Math.cos(angle);
      const pointY = r * Math.sin(angle);

      if (i === 0) {
        ctx.moveTo(pointX, pointY);
      } else {
        ctx.lineTo(pointX, pointY);
      }
    }

    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Smoothly adapt existing stars to new dimensions and adjust star count based on viewport area
   */
  private adaptToNewDimensions(
    newDim: Dimensions,
    a11y: AccessibilitySettings
  ) {
    if (!this.lastDimensions) {
      this.initialize(newDim, a11y);
      return;
    }

    const scaleX = newDim.width / this.lastDimensions.width;
    const scaleY = newDim.height / this.lastDimensions.height;

    // Calculate area ratio to determine if we need more or fewer stars
    const oldArea = this.lastDimensions.width * this.lastDimensions.height;
    const newArea = newDim.width * newDim.height;
    const areaRatio = newArea / oldArea;

    (["far", "mid", "near"] as Array<keyof typeof this.layers>).forEach(
      (key) => {
        const layer = this.layers[key];
        const pCfg = this.config[key];

        // Calculate optimal star count for new dimensions
        const density = pCfg.density * this.qualitySettings.densityMultiplier;
        const optimalCount = Math.floor(newDim.width * newDim.height * density);
        const currentCount = layer.stars.length;

        // Adjust star count based on new viewport area
        if (areaRatio > 1.2 && currentCount < optimalCount) {
          // Viewport got significantly larger - add more stars
          const starsToAdd = Math.min(
            optimalCount - currentCount,
            Math.floor(currentCount * 0.5)
          );

          for (let i = 0; i < starsToAdd; i++) {
            layer.stars.push(
              this.calculationService.makeStar(newDim, this.starConfig, a11y)
            );
          }
        } else if (areaRatio < 0.8 && currentCount > optimalCount) {
          // Viewport got significantly smaller - remove excess stars
          const starsToRemove = Math.min(
            currentCount - optimalCount,
            Math.floor(currentCount * 0.3)
          );

          layer.stars.splice(0, starsToRemove);
        }

        // Redistribute remaining stars to new dimensions
        this.redistributeStars(layer.stars, newDim, scaleX, scaleY);

        // Update drift values for new dimensions
        layer.driftX = pCfg.drift * newDim.width;
        layer.driftY = pCfg.drift * newDim.height;
      }
    );
  }

  /**
   * Smoothly redistribute stars when canvas dimensions change
   */
  private redistributeStars(
    stars: Star[],
    newDim: Dimensions,
    scaleX: number,
    scaleY: number
  ) {
    // Scale all star positions proportionally
    stars.forEach((star) => {
      star.x = star.x * scaleX;
      star.y = star.y * scaleY;
    });

    // Handle stars that are now out of bounds
    stars.forEach((star) => {
      // Wrap stars that went out of bounds back into the visible area
      if (star.x >= newDim.width) {
        star.x = star.x % newDim.width;
      }
      if (star.y >= newDim.height) {
        star.y = star.y % newDim.height;
      }

      // Ensure no negative coordinates
      if (star.x < 0) star.x = 0;
      if (star.y < 0) star.y = 0;
    });
  }

  getNearStars(): Star[] {
    return this.layers.near.stars;
  }

  cleanup() {
    this.layers = {
      far: { stars: [], driftX: 0, driftY: 0 },
      mid: { stars: [], driftX: 0, driftY: 0 },
      near: { stars: [], driftX: 0, driftY: 0 },
    };
    this.diffractionStars = [];
    this.lastDimensions = null;
  }
}
