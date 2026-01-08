import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type {
  CloudControlPoint,
  EmbeddedStar,
  Filament,
  NebulaCloud,
} from "../domain/models/night-sky-models";
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";

// ============================================================================
// NEBULA SYSTEM - Atmospheric Clouds with Organic Beauty
// ============================================================================
// Transforms simple pulsing circles into emission nebula-style clouds with:
// - Irregular organic shapes using bezier curves
// - Multi-layer color gradients (pink/purple/blue like real nebulae)
// - Embedded bright stars with pulsing glow
// - Wispy filament extensions with wave animation
// - Traveling shimmer highlight (like fish iridescence)
// ============================================================================

export interface NebulaConfig {
  count: number;
  minRadius: number;
  maxRadius: number;
  controlPointCount: number;
  embeddedStarCount: number;
  filamentCount: number;
  colorPalettes: {
    primary: string;
    secondary: string;
    accent: string;
  }[];
  glowPulseSpeed: number;
  shimmerSpeed: number;
  colorShiftSpeed: number;
  filamentWaveSpeed: number;
  baseOpacity: number;
  enabledOnQuality: QualityLevel[];
  quality: {
    high: {
      filaments: boolean;
      embeddedStars: boolean;
      shimmer: boolean;
      colorShift: boolean;
    };
    medium: {
      filaments: boolean;
      embeddedStars: boolean;
      shimmer: boolean;
      colorShift: boolean;
    };
  };
}

export class NebulaSystem {
  private nebulae: NebulaCloud[] = [];
  private config: NebulaConfig;
  private calculationService: INightSkyCalculationService;
  private quality: QualityLevel = "medium";
  private dimensions: Dimensions = { width: 0, height: 0 };

  constructor(
    config: NebulaConfig,
    calculationService: INightSkyCalculationService
  ) {
    this.config = config;
    this.calculationService = calculationService;
  }

  // ==========================================================================
  // INITIALIZATION
  // ==========================================================================

  initialize(dim: Dimensions, quality: QualityLevel) {
    this.dimensions = dim;
    this.quality = quality;

    if (!this.config.enabledOnQuality.includes(quality)) {
      this.nebulae = [];
      return;
    }

    this.nebulae = Array.from({ length: this.config.count }).map(() =>
      this.createNebula(dim)
    );
  }

  private createNebula(dim: Dimensions): NebulaCloud {
    const baseRadius = this.calculationService.randFloat(
      this.config.minRadius,
      this.config.maxRadius
    );

    // Position in upper 60% of screen (nebulae belong in the sky)
    const x = Math.random() * dim.width;
    const y = Math.random() * dim.height * 0.6;

    // Select a random color palette
    const palette = this.calculationService.randItem(this.config.colorPalettes);

    // Create control points for organic shape
    const controlPoints = this.createControlPoints();

    // Create color layers for multi-layer gradient
    const colorLayers = [
      { color: palette.accent, opacity: 0.3, radiusMultiplier: 1.4 },
      { color: palette.secondary, opacity: 0.5, radiusMultiplier: 1.0 },
      { color: palette.primary, opacity: 0.7, radiusMultiplier: 0.6 },
    ];

    // Create embedded stars
    const embeddedStars = this.createEmbeddedStars();

    // Create filaments
    const filaments = this.createFilaments();

    // Generate edge seeds for organic variation
    const edgeSeeds = Array.from({ length: 12 }, () => Math.random());

    return {
      x,
      y,
      baseRadius,
      controlPoints,
      colorLayers,
      embeddedStars,
      filaments,
      glowPhase: Math.random() * Math.PI * 2,
      shimmerPhase: Math.random(),
      colorShiftPhase: Math.random() * Math.PI * 2,
      edgeSeeds,
    };
  }

  private createControlPoints(): CloudControlPoint[] {
    const count = this.config.controlPointCount;
    const points: CloudControlPoint[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      // Vary distance for organic shape (0.7 to 1.3 of base radius)
      const distance = 0.7 + Math.random() * 0.6;
      const seed = Math.random();

      points.push({ angle, distance, seed });
    }

    return points;
  }

  private createEmbeddedStars(): EmbeddedStar[] {
    const count = this.config.embeddedStarCount;
    const stars: EmbeddedStar[] = [];
    const starColors = ["#ffffff", "#fff8f0", "#f0f8ff", "#fffaf0"];

    for (let i = 0; i < count; i++) {
      // Random position within nebula (avoid edges)
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 0.6; // Stay within 60% of radius

      stars.push({
        offsetX: Math.cos(angle) * dist,
        offsetY: Math.sin(angle) * dist,
        sizeRatio: 0.02 + Math.random() * 0.03, // 2-5% of nebula size
        brightness: 0.5 + Math.random() * 0.5,
        pulsePhase: Math.random() * Math.PI * 2,
        color: this.calculationService.randItem(starColors),
      });
    }

    return stars;
  }

  private createFilaments(): Filament[] {
    const count = this.config.filamentCount;
    const filaments: Filament[] = [];

    for (let i = 0; i < count; i++) {
      const startAngle = Math.random() * Math.PI * 2;

      filaments.push({
        startAngle,
        length: 0.8 + Math.random() * 0.8, // 0.8 to 1.6 of nebula radius
        baseWidth: 0.15 + Math.random() * 0.1, // 15-25% of length
        curvature: (Math.random() - 0.5) * 2, // -1 to 1
        opacity: 0.3 + Math.random() * 0.3,
        seeds: Array.from({ length: 6 }, () => Math.random()),
        phaseOffset: Math.random() * Math.PI * 2,
      });
    }

    return filaments;
  }

  // ==========================================================================
  // UPDATE
  // ==========================================================================

  update(a11y: AccessibilitySettings, frameMultiplier: number = 1.0) {
    if (!this.nebulae.length) return;

    const effectiveSpeed = frameMultiplier * (a11y.reducedMotion ? 0.3 : 1);
    const qualitySettings = this.getQualitySettings();

    for (const nebula of this.nebulae) {
      // Update glow phase (breathing)
      nebula.glowPhase += this.config.glowPulseSpeed * effectiveSpeed;

      // Update shimmer phase (traveling highlight)
      if (qualitySettings.shimmer) {
        nebula.shimmerPhase += this.config.shimmerSpeed * effectiveSpeed;
        if (nebula.shimmerPhase > 1) nebula.shimmerPhase -= 1;
      }

      // Update color shift phase
      if (qualitySettings.colorShift) {
        nebula.colorShiftPhase += this.config.colorShiftSpeed * effectiveSpeed;
      }

      // Update embedded star phases
      if (qualitySettings.embeddedStars) {
        for (const star of nebula.embeddedStars) {
          star.pulsePhase += 0.002 * effectiveSpeed;
        }
      }

      // Update filament phases
      if (qualitySettings.filaments) {
        for (const filament of nebula.filaments) {
          filament.phaseOffset += this.config.filamentWaveSpeed * effectiveSpeed;
        }
      }
    }
  }

  // ==========================================================================
  // DRAWING
  // ==========================================================================

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings) {
    if (!this.nebulae.length) return;

    const qualitySettings = this.getQualitySettings();
    const baseAlpha = a11y.reducedMotion ? 0.6 : 1;

    for (const nebula of this.nebulae) {
      ctx.save();

      // Draw filaments first (behind main cloud)
      if (qualitySettings.filaments) {
        this.drawFilaments(ctx, nebula, baseAlpha);
      }

      // Draw main cloud layers (back to front)
      this.drawCloudLayers(ctx, nebula, baseAlpha, qualitySettings);

      // Draw shimmer highlight
      if (qualitySettings.shimmer) {
        this.drawShimmer(ctx, nebula, baseAlpha);
      }

      // Draw embedded stars
      if (qualitySettings.embeddedStars) {
        this.drawEmbeddedStars(ctx, nebula, baseAlpha);
      }

      ctx.restore();
    }
  }

  private drawCloudLayers(
    ctx: CanvasRenderingContext2D,
    nebula: NebulaCloud,
    baseAlpha: number,
    qualitySettings: ReturnType<typeof this.getQualitySettings>
  ) {
    // Breathing effect
    const breathe = 1 + 0.05 * Math.sin(nebula.glowPhase);

    // Draw each layer from back to front
    for (let i = 0; i < nebula.colorLayers.length; i++) {
      const layer = nebula.colorLayers[i];
      if (!layer) continue;

      const radius = nebula.baseRadius * layer.radiusMultiplier * breathe;

      // Apply color shift if enabled
      let color = layer.color;
      if (qualitySettings.colorShift) {
        color = this.shiftColor(layer.color, nebula.colorShiftPhase, 0.1);
      }

      ctx.globalAlpha = baseAlpha * layer.opacity * this.config.baseOpacity;

      // Draw organic cloud shape
      this.drawOrganicCloud(ctx, nebula, radius, color);
    }
  }

  private drawOrganicCloud(
    ctx: CanvasRenderingContext2D,
    nebula: NebulaCloud,
    radius: number,
    color: string
  ) {
    const points = nebula.controlPoints;
    const cx = nebula.x;
    const cy = nebula.y;

    // Create gradient
    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.6, this.adjustAlpha(color, 0.5));
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Use bezier curves for organic shape
    const firstPoint = points[0];
    if (!firstPoint) return;

    const firstX = cx + Math.cos(firstPoint.angle) * radius * firstPoint.distance;
    const firstY = cy + Math.sin(firstPoint.angle) * radius * firstPoint.distance;
    ctx.moveTo(firstX, firstY);

    for (let i = 0; i < points.length; i++) {
      const current = points[i];
      const next = points[(i + 1) % points.length];
      if (!current || !next) continue;

      // Add organic edge variation using seeds
      const edgeVar = this.getEdgeVariation(nebula.edgeSeeds, i, nebula.glowPhase);

      const currentX =
        cx + Math.cos(current.angle) * radius * current.distance * (1 + edgeVar * 0.1);
      const currentY =
        cy + Math.sin(current.angle) * radius * current.distance * (1 + edgeVar * 0.1);

      const nextX = cx + Math.cos(next.angle) * radius * next.distance;
      const nextY = cy + Math.sin(next.angle) * radius * next.distance;

      // Control point for smooth curve
      const midAngle = (current.angle + next.angle) / 2;
      const midDist = (current.distance + next.distance) / 2;
      const cpX = cx + Math.cos(midAngle) * radius * midDist * 1.1;
      const cpY = cy + Math.sin(midAngle) * radius * midDist * 1.1;

      ctx.quadraticCurveTo(cpX, cpY, nextX, nextY);
    }

    ctx.closePath();
    ctx.fill();
  }

  private drawFilaments(
    ctx: CanvasRenderingContext2D,
    nebula: NebulaCloud,
    baseAlpha: number
  ) {
    for (const filament of nebula.filaments) {
      this.drawFilament(ctx, nebula, filament, baseAlpha);
    }
  }

  private drawFilament(
    ctx: CanvasRenderingContext2D,
    nebula: NebulaCloud,
    filament: Filament,
    baseAlpha: number
  ) {
    const startAngle = filament.startAngle;
    const length = nebula.baseRadius * filament.length;
    const baseWidth = length * filament.baseWidth;

    // Start point at edge of nebula
    const startX = nebula.x + Math.cos(startAngle) * nebula.baseRadius * 0.8;
    const startY = nebula.y + Math.sin(startAngle) * nebula.baseRadius * 0.8;

    // End point with wave animation
    const waveOffset = Math.sin(filament.phaseOffset) * 0.2;
    const endAngle = startAngle + filament.curvature * 0.3 + waveOffset;
    const endX = startX + Math.cos(endAngle) * length;
    const endY = startY + Math.sin(endAngle) * length;

    // Control point for curve
    const cpAngle = startAngle + filament.curvature * 0.5;
    const cpDist = length * 0.6;
    const cpX = startX + Math.cos(cpAngle) * cpDist;
    const cpY = startY + Math.sin(cpAngle) * cpDist;

    // Create gradient along filament
    const gradient = ctx.createLinearGradient(startX, startY, endX, endY);
    const baseColor = nebula.colorLayers[1]?.color || "rgba(180, 100, 255, 0.1)";
    gradient.addColorStop(0, baseColor);
    gradient.addColorStop(0.5, this.adjustAlpha(baseColor, 0.6));
    gradient.addColorStop(1, "transparent");

    ctx.globalAlpha = baseAlpha * filament.opacity * this.config.baseOpacity;
    ctx.strokeStyle = gradient;
    ctx.lineWidth = baseWidth;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(startX, startY);
    ctx.quadraticCurveTo(cpX, cpY, endX, endY);
    ctx.stroke();

    // Draw tapered edges
    ctx.lineWidth = baseWidth * 0.3;
    ctx.globalAlpha *= 0.5;
    ctx.stroke();
  }

  private drawShimmer(
    ctx: CanvasRenderingContext2D,
    nebula: NebulaCloud,
    baseAlpha: number
  ) {
    // Traveling shimmer highlight (like fish iridescence)
    const shimmerAngle = nebula.shimmerPhase * Math.PI * 2;
    const shimmerDist = nebula.baseRadius * 0.4;

    const shimmerX = nebula.x + Math.cos(shimmerAngle) * shimmerDist;
    const shimmerY = nebula.y + Math.sin(shimmerAngle) * shimmerDist;
    const shimmerRadius = nebula.baseRadius * 0.3;

    const gradient = ctx.createRadialGradient(
      shimmerX,
      shimmerY,
      0,
      shimmerX,
      shimmerY,
      shimmerRadius
    );
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.15)");
    gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.05)");
    gradient.addColorStop(1, "transparent");

    ctx.globalAlpha = baseAlpha * 0.6;
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(shimmerX, shimmerY, shimmerRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawEmbeddedStars(
    ctx: CanvasRenderingContext2D,
    nebula: NebulaCloud,
    baseAlpha: number
  ) {
    for (const star of nebula.embeddedStars) {
      const x = nebula.x + star.offsetX * nebula.baseRadius;
      const y = nebula.y + star.offsetY * nebula.baseRadius;
      const size = nebula.baseRadius * star.sizeRatio;

      // Pulsing brightness
      const pulse = 0.7 + 0.3 * Math.sin(star.pulsePhase);
      const brightness = star.brightness * pulse;

      // Draw glow
      const glowGradient = ctx.createRadialGradient(x, y, 0, x, y, size * 3);
      glowGradient.addColorStop(0, this.adjustAlpha(star.color, brightness * 0.8));
      glowGradient.addColorStop(0.3, this.adjustAlpha(star.color, brightness * 0.3));
      glowGradient.addColorStop(1, "transparent");

      ctx.globalAlpha = baseAlpha;
      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(x, y, size * 3, 0, Math.PI * 2);
      ctx.fill();

      // Draw core
      ctx.globalAlpha = baseAlpha * brightness;
      ctx.fillStyle = star.color;
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private getQualitySettings() {
    if (this.quality === "high") {
      return this.config.quality.high;
    }
    return this.config.quality.medium;
  }

  private getEdgeVariation(seeds: number[], index: number, phase: number): number {
    if (seeds.length === 0) return 0;
    const seed1 = seeds[index % seeds.length] ?? 0;
    const seed2 = seeds[(index + 1) % seeds.length] ?? 0;
    return Math.sin(phase + seed1 * Math.PI * 2) * seed2;
  }

  private adjustAlpha(color: string, multiplier: number): string {
    // Parse rgba color and adjust alpha
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    if (match && match[1] && match[2] && match[3]) {
      const r = match[1];
      const g = match[2];
      const b = match[3];
      const a = parseFloat(match[4] || "1") * multiplier;
      return `rgba(${r}, ${g}, ${b}, ${a})`;
    }
    return color;
  }

  private shiftColor(color: string, phase: number, amount: number): string {
    // Simple hue shift by adjusting RGB channels slightly
    const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+),?\s*([\d.]+)?\)/);
    if (match && match[1] && match[2] && match[3]) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const a = match[4] || "1";

      const shift = Math.sin(phase) * amount * 30;
      const newR = Math.max(0, Math.min(255, r + shift));
      const newG = Math.max(0, Math.min(255, g - shift * 0.5));
      const newB = Math.max(0, Math.min(255, b + shift * 0.3));

      return `rgba(${Math.round(newR)}, ${Math.round(newG)}, ${Math.round(newB)}, ${a})`;
    }
    return color;
  }

  cleanup() {
    this.nebulae = [];
  }
}
