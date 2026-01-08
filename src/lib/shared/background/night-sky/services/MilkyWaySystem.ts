/**
 * MilkyWaySystem - The Hero Element
 *
 * Creates a luminous river of stars across the sky with:
 * - Multi-layer gradient rendering (like fish iridescence)
 * - Dark dust lanes with organic edges (like jellyfish mesoglea)
 * - Bright star clusters with pulsing (like bioluminescence)
 * - Traveling shimmer wave across the band
 * - Organic edge variation using seed arrays (like dappled light rays)
 *
 * Visual approach inspired by Deep Ocean's techniques:
 * - Every element has multiple independent animation phases
 * - Multi-layer gradients create depth
 * - Seed-based organic variation prevents geometric feel
 */

import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type {
  DustLane,
  MilkyWayBand,
  StarCloud,
} from "../domain/models/night-sky-models";
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";

interface MilkyWayConfig {
  bandWidthPercent: number;
  pathPoints: number;
  dustLaneCount: number;
  starCloudCount: number;
  baseOpacity: number;
  coreOpacity: number;
  edgeOpacity: number;
  colors: {
    edge: string;
    mid: string;
    core: string;
  };
  shimmerSpeed: number;
  glowPulseSpeed: number;
  dustLaneDriftSpeed: number;
  starCloudPulseSpeed: number;
  enabledOnQuality: ("high" | "medium" | "low" | "minimal")[];
  quality: {
    high: QualityFeatures;
    medium: QualityFeatures;
  };
}

interface QualityFeatures {
  dustLanes: boolean;
  starClouds: boolean;
  shimmer: boolean;
  edgeDetail: boolean;
}

export class MilkyWaySystem {
  private band: MilkyWayBand | null = null;
  private config: MilkyWayConfig;
  private calculationService: INightSkyCalculationService;
  private quality: QualityLevel = "high";
  private lastDimensions: Dimensions | null = null;

  constructor(
    config: MilkyWayConfig,
    calculationService: INightSkyCalculationService
  ) {
    this.config = config;
    this.calculationService = calculationService;
  }

  initialize(dim: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.lastDimensions = dim;

    // Check if quality level is enabled (ultra-minimal is never enabled)
    const enabledQualities = this.config.enabledOnQuality as readonly QualityLevel[];
    if (!enabledQualities.includes(quality)) {
      this.band = null;
      return;
    }

    // Generate the Milky Way band path - diagonal across the sky
    const pathPoints = this.generateBandPath(dim);
    const widths = this.generateBandWidths(dim, pathPoints.length);

    // Generate dust lanes (dark regions)
    const dustLanes = this.generateDustLanes();

    // Generate star clusters (bright regions)
    const starClouds = this.generateStarClouds();

    // Generate edge seeds for organic variation
    const edgeSeeds = Array.from({ length: 20 }, () => Math.random());

    this.band = {
      pathPoints,
      widths,
      dustLanes,
      starClouds,
      glowPhase: Math.random() * Math.PI * 2,
      shimmerPhase: Math.random(),
      edgeSeeds,
    };
  }

  /**
   * Generate the curved path across the sky
   * The Milky Way should stretch diagonally with a slight S-curve
   */
  private generateBandPath(dim: Dimensions): { x: number; y: number }[] {
    const points: { x: number; y: number }[] = [];
    const numPoints = this.config.pathPoints;

    // Diagonal from bottom-left to top-right with organic variation
    for (let i = 0; i < numPoints; i++) {
      const t = i / (numPoints - 1);

      // Base diagonal position
      const baseX = t * dim.width;
      const baseY = dim.height * (1 - t * 0.9); // Slight angle adjustment

      // Add organic S-curve variation
      const curveAmount = Math.sin(t * Math.PI) * dim.height * 0.15;
      const xVariation = Math.sin(t * Math.PI * 2) * dim.width * 0.05;

      points.push({
        x: baseX + xVariation,
        y: baseY - curveAmount,
      });
    }

    return points;
  }

  /**
   * Generate varying widths along the band
   * Wider in the middle (galactic center), narrower at edges
   */
  private generateBandWidths(dim: Dimensions, numPoints: number): number[] {
    const diagonal = Math.sqrt(dim.width ** 2 + dim.height ** 2);
    const baseWidth = diagonal * this.config.bandWidthPercent;

    return Array.from({ length: numPoints }, (_, i) => {
      const t = i / (numPoints - 1);
      // Wider in the middle section (galactic bulge)
      const bulge = 1 + Math.sin(t * Math.PI) * 0.4;
      return baseWidth * bulge;
    });
  }

  /**
   * Generate dust lanes - dark regions that create depth
   */
  private generateDustLanes(): DustLane[] {
    const lanes: DustLane[] = [];

    for (let i = 0; i < this.config.dustLaneCount; i++) {
      lanes.push({
        startT: 0.1 + (i / this.config.dustLaneCount) * 0.7,
        length: 0.1 + Math.random() * 0.15,
        width: 0.2 + Math.random() * 0.3,
        opacity: 0.3 + Math.random() * 0.4,
        phaseOffset: Math.random() * Math.PI * 2,
        edgeSeeds: Array.from({ length: 8 }, () => Math.random()),
      });
    }

    return lanes;
  }

  /**
   * Generate star clusters - bright regions within the band
   */
  private generateStarClouds(): StarCloud[] {
    const clouds: StarCloud[] = [];
    const colors = ["#ffffff", "#fff8e8", "#e8f0ff", "#ffe8f0"];

    for (let i = 0; i < this.config.starCloudCount; i++) {
      clouds.push({
        t: 0.1 + Math.random() * 0.8,
        offset: (Math.random() - 0.5) * 0.6,
        size: 0.15 + Math.random() * 0.2,
        brightness: 0.4 + Math.random() * 0.4,
        pulsePhase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)]!,
      });
    }

    return clouds;
  }

  update(a11y: AccessibilitySettings, frameMultiplier: number = 1.0): void {
    if (!this.band) return;

    const effectiveSpeed = frameMultiplier * (a11y.reducedMotion ? 0.2 : 1);

    // Update overall glow phase
    this.band.glowPhase += this.config.glowPulseSpeed * effectiveSpeed;

    // Update traveling shimmer
    this.band.shimmerPhase =
      (this.band.shimmerPhase + this.config.shimmerSpeed * effectiveSpeed) % 1;

    // Update dust lane phases
    for (const lane of this.band.dustLanes) {
      lane.phaseOffset += this.config.dustLaneDriftSpeed * effectiveSpeed;
    }

    // Update star cloud pulses
    for (const cloud of this.band.starClouds) {
      cloud.pulsePhase += this.config.starCloudPulseSpeed * effectiveSpeed;
    }
  }

  draw(ctx: CanvasRenderingContext2D, a11y: AccessibilitySettings): void {
    if (!this.band || this.band.pathPoints.length < 2) return;

    const features = this.getQualityFeatures();

    ctx.save();
    ctx.globalAlpha = a11y.reducedMotion ? 0.6 : 1;

    // Layer 1: Base glow band
    this.drawBaseGlow(ctx);

    // Layer 2: Core brightness (brighter center)
    this.drawCoreBrightness(ctx);

    // Layer 3: Dust lanes (dark regions) - HIGH quality only
    if (features.dustLanes) {
      this.drawDustLanes(ctx);
    }

    // Layer 4: Star clusters (bright spots)
    if (features.starClouds) {
      this.drawStarClouds(ctx);
    }

    // Layer 5: Traveling shimmer - HIGH quality only
    if (features.shimmer) {
      this.drawShimmer(ctx);
    }

    // Layer 6: Edge detail with organic variation - HIGH quality only
    if (features.edgeDetail) {
      this.drawEdgeHighlights(ctx);
    }

    ctx.restore();
  }

  /**
   * Draw the base glow - the foundational gradient band
   */
  private drawBaseGlow(ctx: CanvasRenderingContext2D): void {
    if (!this.band) return;

    const { pathPoints, widths, glowPhase } = this.band;

    // Subtle breathing effect
    const breathe = 1 + Math.sin(glowPhase) * 0.05;
    const opacity = this.config.baseOpacity * breathe;

    ctx.globalAlpha = opacity;

    // Draw the band as a series of connected segments
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i]!;
      const p2 = pathPoints[i + 1]!;
      const w1 = widths[i]! * breathe;
      const w2 = widths[i + 1]! * breathe;

      this.drawBandSegment(ctx, p1, p2, w1, w2, i);
    }
  }

  /**
   * Draw a single segment of the band with gradient
   */
  private drawBandSegment(
    ctx: CanvasRenderingContext2D,
    p1: { x: number; y: number },
    p2: { x: number; y: number },
    w1: number,
    w2: number,
    segmentIndex: number
  ): void {
    if (!this.band) return;

    // Calculate perpendicular direction
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;

    // Get organic edge variation
    const edgeVar1 = this.getEdgeVariation(segmentIndex, 0);
    const edgeVar2 = this.getEdgeVariation(segmentIndex, 1);
    const edgeVar3 = this.getEdgeVariation(segmentIndex + 1, 0);
    const edgeVar4 = this.getEdgeVariation(segmentIndex + 1, 1);

    // Calculate corner points with organic variation
    const corners = [
      { x: p1.x + nx * w1 * 0.5 * edgeVar1, y: p1.y + ny * w1 * 0.5 * edgeVar1 },
      { x: p1.x - nx * w1 * 0.5 * edgeVar2, y: p1.y - ny * w1 * 0.5 * edgeVar2 },
      { x: p2.x - nx * w2 * 0.5 * edgeVar4, y: p2.y - ny * w2 * 0.5 * edgeVar4 },
      { x: p2.x + nx * w2 * 0.5 * edgeVar3, y: p2.y + ny * w2 * 0.5 * edgeVar3 },
    ];

    // Create gradient perpendicular to band direction
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    const gradW = ((w1 + w2) / 2) * 0.6;

    const gradient = ctx.createLinearGradient(
      midX + nx * gradW,
      midY + ny * gradW,
      midX - nx * gradW,
      midY - ny * gradW
    );

    // Multi-layer gradient for depth (like fish iridescence)
    gradient.addColorStop(0, "rgba(180, 200, 255, 0)");
    gradient.addColorStop(0.2, "rgba(180, 200, 255, 0.3)");
    gradient.addColorStop(0.4, "rgba(220, 210, 240, 0.6)");
    gradient.addColorStop(0.5, "rgba(255, 245, 230, 0.8)");
    gradient.addColorStop(0.6, "rgba(220, 210, 240, 0.6)");
    gradient.addColorStop(0.8, "rgba(180, 200, 255, 0.3)");
    gradient.addColorStop(1, "rgba(180, 200, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.moveTo(corners[0]!.x, corners[0]!.y);
    ctx.lineTo(corners[1]!.x, corners[1]!.y);
    ctx.lineTo(corners[2]!.x, corners[2]!.y);
    ctx.lineTo(corners[3]!.x, corners[3]!.y);
    ctx.closePath();
    ctx.fill();
  }

  /**
   * Get organic edge variation using seed arrays (like dappled light rays)
   */
  private getEdgeVariation(segmentIndex: number, side: number): number {
    if (!this.band) return 1;

    const seedIndex = (segmentIndex * 2 + side) % this.band.edgeSeeds.length;
    const seed = this.band.edgeSeeds[seedIndex] ?? 0.5;

    // Variation between 0.85 and 1.15
    return 0.85 + seed * 0.3;
  }

  /**
   * Draw the brighter core region
   */
  private drawCoreBrightness(ctx: CanvasRenderingContext2D): void {
    if (!this.band) return;

    const { pathPoints, widths, glowPhase } = this.band;
    const coreBreath = 1 + Math.sin(glowPhase * 1.3) * 0.08;

    ctx.globalAlpha = this.config.coreOpacity * coreBreath;

    // Draw narrower, brighter core
    for (let i = 0; i < pathPoints.length - 1; i++) {
      const p1 = pathPoints[i]!;
      const p2 = pathPoints[i + 1]!;
      const w1 = widths[i]! * 0.4 * coreBreath;
      const w2 = widths[i + 1]! * 0.4 * coreBreath;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const gradW = (w1 + w2) / 2;

      const gradient = ctx.createLinearGradient(
        midX + nx * gradW,
        midY + ny * gradW,
        midX - nx * gradW,
        midY - ny * gradW
      );

      // Warmer, brighter core
      gradient.addColorStop(0, "rgba(255, 250, 240, 0)");
      gradient.addColorStop(0.3, "rgba(255, 250, 240, 0.4)");
      gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.7)");
      gradient.addColorStop(0.7, "rgba(255, 250, 240, 0.4)");
      gradient.addColorStop(1, "rgba(255, 250, 240, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();

      const corners = [
        { x: p1.x + nx * w1 * 0.5, y: p1.y + ny * w1 * 0.5 },
        { x: p1.x - nx * w1 * 0.5, y: p1.y - ny * w1 * 0.5 },
        { x: p2.x - nx * w2 * 0.5, y: p2.y - ny * w2 * 0.5 },
        { x: p2.x + nx * w2 * 0.5, y: p2.y + ny * w2 * 0.5 },
      ];

      ctx.moveTo(corners[0]!.x, corners[0]!.y);
      ctx.lineTo(corners[1]!.x, corners[1]!.y);
      ctx.lineTo(corners[2]!.x, corners[2]!.y);
      ctx.lineTo(corners[3]!.x, corners[3]!.y);
      ctx.closePath();
      ctx.fill();
    }
  }

  /**
   * Draw dust lanes - dark absorption regions (like jellyfish mesoglea)
   */
  private drawDustLanes(ctx: CanvasRenderingContext2D): void {
    if (!this.band) return;

    const { pathPoints, widths, dustLanes } = this.band;

    ctx.globalCompositeOperation = "destination-out";

    for (const lane of dustLanes) {
      const startIdx = Math.floor(lane.startT * (pathPoints.length - 1));
      const endIdx = Math.min(
        startIdx + Math.ceil(lane.length * pathPoints.length),
        pathPoints.length - 1
      );

      // Animated opacity
      const animatedOpacity =
        lane.opacity * (0.7 + 0.3 * Math.sin(lane.phaseOffset));

      ctx.globalAlpha = animatedOpacity * 0.6;

      for (let i = startIdx; i < endIdx; i++) {
        const p1 = pathPoints[i]!;
        const p2 = pathPoints[i + 1];
        if (!p2) continue;

        const w1 = widths[i]! * lane.width;
        const w2 = widths[i + 1]! * lane.width;

        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;

        // Organic edge using lane's seeds
        const edgeVar = lane.edgeSeeds[(i - startIdx) % lane.edgeSeeds.length]!;
        const variation = 0.8 + edgeVar * 0.4;

        const midX = (p1.x + p2.x) / 2;
        const midY = (p1.y + p2.y) / 2;

        const gradient = ctx.createRadialGradient(
          midX,
          midY,
          0,
          midX,
          midY,
          ((w1 + w2) / 2) * variation
        );

        gradient.addColorStop(0, "rgba(0, 0, 0, 1)");
        gradient.addColorStop(0.5, "rgba(0, 0, 0, 0.5)");
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(midX, midY, ((w1 + w2) / 2) * variation, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.globalCompositeOperation = "source-over";
  }

  /**
   * Draw star clusters - bright regions (like bioluminescence spots)
   */
  private drawStarClouds(ctx: CanvasRenderingContext2D): void {
    if (!this.band) return;

    const { pathPoints, widths, starClouds } = this.band;

    for (const cloud of starClouds) {
      const idx = Math.floor(cloud.t * (pathPoints.length - 1));
      const point = pathPoints[idx];
      const width = widths[idx];
      if (!point || !width) continue;

      // Calculate position along the band
      const nextPoint = pathPoints[idx + 1] ?? point;
      const dx = nextPoint.x - point.x;
      const dy = nextPoint.y - point.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;

      // Offset from center
      const offsetX = nx * width * cloud.offset * 0.4;
      const offsetY = ny * width * cloud.offset * 0.4;

      const cx = point.x + offsetX;
      const cy = point.y + offsetY;
      const r = width * cloud.size;

      // Pulsing brightness (like bioluminescence)
      const pulse = 0.6 + 0.4 * Math.sin(cloud.pulsePhase);
      const brightness = cloud.brightness * pulse;

      ctx.globalAlpha = brightness * 0.5;

      // Multi-layer glow
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, cloud.color);
      gradient.addColorStop(0.3, this.adjustAlpha(cloud.color, 0.6));
      gradient.addColorStop(0.6, this.adjustAlpha(cloud.color, 0.3));
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // Inner bright core
      ctx.globalAlpha = brightness * 0.3;
      const coreGradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 0.4);
      coreGradient.addColorStop(0, "#ffffff");
      coreGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = coreGradient;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw traveling shimmer wave (like fish iridescence wave)
   */
  private drawShimmer(ctx: CanvasRenderingContext2D): void {
    if (!this.band) return;

    const { pathPoints, widths, shimmerPhase } = this.band;

    // Shimmer wave travels along the band
    const waveWidth = 0.15; // Width of the shimmer wave

    for (let i = 0; i < pathPoints.length - 1; i++) {
      const t = i / (pathPoints.length - 1);

      // Calculate distance from shimmer wave center
      let distFromWave = Math.abs(t - shimmerPhase);
      if (distFromWave > 0.5) distFromWave = 1 - distFromWave; // Wrap around

      if (distFromWave > waveWidth) continue;

      const intensity = 1 - distFromWave / waveWidth;
      const p1 = pathPoints[i]!;
      const p2 = pathPoints[i + 1]!;
      const w = (widths[i]! + widths[i + 1]!) / 2;

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;

      ctx.globalAlpha = intensity * 0.15;

      const gradient = ctx.createRadialGradient(
        midX,
        midY,
        0,
        midX,
        midY,
        w * 0.6
      );

      // Iridescent shimmer colors
      const hue = (shimmerPhase * 360 + i * 20) % 360;
      gradient.addColorStop(0, `hsla(${hue}, 60%, 85%, 1)`);
      gradient.addColorStop(0.5, `hsla(${hue + 30}, 50%, 80%, 0.5)`);
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(midX, midY, w * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /**
   * Draw subtle edge highlights
   */
  private drawEdgeHighlights(ctx: CanvasRenderingContext2D): void {
    if (!this.band) return;

    const { pathPoints, widths, glowPhase } = this.band;

    ctx.globalAlpha = 0.03 + Math.sin(glowPhase * 0.7) * 0.01;
    ctx.strokeStyle = "rgba(200, 220, 255, 0.5)";
    ctx.lineWidth = 1;

    // Draw subtle edge lines with organic variation
    ctx.beginPath();
    for (let i = 0; i < pathPoints.length; i++) {
      const p = pathPoints[i]!;
      const w = widths[i]!;
      const nextP = pathPoints[i + 1];
      if (!nextP) continue;

      const dx = nextP.x - p.x;
      const dy = nextP.y - p.y;
      const len = Math.sqrt(dx * dx + dy * dy);
      const nx = -dy / len;
      const ny = dx / len;

      const edgeVar = this.getEdgeVariation(i, 0);
      const x = p.x + nx * w * 0.5 * edgeVar;
      const y = p.y + ny * w * 0.5 * edgeVar;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
  }

  /**
   * Helper to adjust color alpha
   */
  private adjustAlpha(color: string, alpha: number): string {
    // Handle hex colors
    if (color.startsWith("#")) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // Handle rgba colors
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }
    return color;
  }

  private getQualityFeatures(): QualityFeatures {
    if (this.quality === "high") {
      return this.config.quality.high;
    }
    return this.config.quality.medium;
  }

  handleResize(newDim: Dimensions): void {
    if (this.band && this.lastDimensions) {
      // Regenerate path for new dimensions
      this.band.pathPoints = this.generateBandPath(newDim);
      this.band.widths = this.generateBandWidths(
        newDim,
        this.band.pathPoints.length
      );
      this.lastDimensions = newDim;
    }
  }

  cleanup(): void {
    this.band = null;
    this.lastDimensions = null;
  }
}
