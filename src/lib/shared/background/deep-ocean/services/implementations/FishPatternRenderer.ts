import type { IFishPatternRenderer } from "../contracts/IFishPatternRenderer";
import type { IColorCalculator } from "../contracts/IColorCalculator";
import type { IFishEffectRenderer } from "../contracts/IFishEffectRenderer";
import type { IFishFinRenderer } from "../contracts/IFishFinRenderer";
import type { IFishFaceRenderer } from "../contracts/IFishFaceRenderer";
import type { IFishBodyRenderer } from "../contracts/IFishBodyRenderer";
import type { FishMarineLife, FishSpecies } from "../../domain/models/DeepOceanModels";
import { SpineChain } from "../../physics/SpineChain";
import { BodyOutlineCalculator, type Point } from "../../physics/BodyOutlineCalculator";

/**
 * Fish pattern rendering configuration (extracted from FishRenderer)
 */
const RENDER_CONFIG = {
  scales: {
    rows: 5,
    perRow: 12,
    size: 0.08,
    shimmerIntensity: 0.15,
  },
  lateralLine: {
    yOffset: 0.05,
    dashLength: 0.03,
    gapLength: 0.02,
  },
  // Body shape control points (fraction of body length)
  bodyShape: {
    // Control points for dorsal (top) curve
    dorsalControlPoints: [
      { x: -0.5, y: 0 }, // Nose
      { x: -0.3, y: -0.4 }, // Forehead rise
      { x: 0.0, y: -0.5 }, // Peak (widest)
      { x: 0.3, y: -0.3 }, // Toward tail
      { x: 0.45, y: -0.1 }, // Tail junction
    ],
    // Control points for ventral (bottom) curve
    ventralControlPoints: [
      { x: -0.5, y: 0 }, // Nose (same as dorsal)
      { x: -0.3, y: 0.25 }, // Lower jaw
      { x: 0.0, y: 0.4 }, // Belly peak
      { x: 0.3, y: 0.25 }, // Toward tail
      { x: 0.45, y: 0.1 }, // Tail junction
    ],
  },
};

/**
 * Species-specific body shape modifiers
 */
const SPECIES_SHAPE: Record<
  FishSpecies,
  {
    dorsalMod: number; // Height multiplier for dorsal curve
    ventralMod: number; // Height multiplier for ventral curve
    noseTaper: number; // How pointed the nose is
    tailTaper: number; // How tapered the tail junction is
  }
> = {
  tropical: {
    dorsalMod: 1.2, // Taller dorsal
    ventralMod: 1.1,
    noseTaper: 0.8, // Rounder nose
    tailTaper: 0.7,
  },
  sleek: {
    dorsalMod: 0.7, // Flatter
    ventralMod: 0.6,
    noseTaper: 1.3, // Pointed nose
    tailTaper: 1.2,
  },
  deep: {
    dorsalMod: 1.0,
    ventralMod: 1.1,
    noseTaper: 0.9,
    tailTaper: 0.8,
  },
  schooling: {
    dorsalMod: 0.9,
    ventralMod: 0.85,
    noseTaper: 1.0,
    tailTaper: 0.9,
  },
};

/**
 * Renders fish patterns (scales, stripes, spots, iridescence, lateral line).
 * Extracted from FishRenderer monolith (~430 lines of pattern rendering logic).
 */
export class FishPatternRenderer implements IFishPatternRenderer {
  private bodyOutlineCalculator = new BodyOutlineCalculator();

  constructor(
    private colorCalc: IColorCalculator,
    private effectRenderer: IFishEffectRenderer,
    private finRenderer: IFishFinRenderer,
    private faceRenderer: IFishFaceRenderer,
    private bodyRenderer: IFishBodyRenderer
  ) {}

  // ========== EXTRACTED PATTERN METHODS ==========

  drawSpineScalePattern(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const shimmer = Math.sin(fish.scalePhase) * 0.15;
    ctx.save();
    ctx.globalAlpha = 0.15 + shimmer;

    const scaleSize = fish.bodyHeight * 0.06;

    // Draw scales along spine
    for (let i = 1; i < spine.joints.length - 1; i++) {
      const joint = spine.joints[i]!;
      const perpAngle = joint.angle + Math.PI / 2;

      // Draw scales on both sides
      for (let row = -2; row <= 2; row++) {
        const offset = row * scaleSize * 0.7;
        if (Math.abs(offset) > joint.width * 0.8) continue;

        const x = joint.x + Math.cos(perpAngle) * offset;
        const y = joint.y + Math.sin(perpAngle) * offset;

        const localShimmer = Math.sin(fish.scalePhase + x * 0.1 + y * 0.05) * 0.1;
        ctx.fillStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.1 + localShimmer);

        ctx.beginPath();
        ctx.arc(x, y, scaleSize, Math.PI * 0.2, Math.PI * 0.8);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Draw stripe patterns for tropical and schooling fish
   * Now with vertical bands for tropical fish - much more vibrant!
   */
  drawSpineStripes(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    // Only tropical and some schooling fish have stripes
    if (fish.species !== "tropical" && fish.species !== "schooling") return;

    ctx.save();

    if (fish.species === "tropical") {
      // TROPICAL: Bold vertical bands like clownfish/angelfish
      this.drawVerticalBands(ctx, fish, spine);
    } else {
      // SCHOOLING: Horizontal racing stripes
      this.drawHorizontalStripes(ctx, fish, spine);
    }

    ctx.restore();
  }

  /**
   * Draw bold vertical bands for tropical fish
   */
  drawVerticalBands(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    // Deterministic band count based on fish properties (not random!)
    const bandCount = 3 + Math.floor((fish.bodyLength * fish.bodyHeight) % 2);
    const bandWidth = fish.bodyLength * 0.07;

    // Fixed contrasting colors - no randomness
    const bandColors = [
      fish.colors.accent,
      "#ffffff",
      fish.colors.accent,
      "#ffffff",
    ];

    // Get body outline for clipping
    const outline = this.bodyOutlineCalculator.calculateOutline(spine);

    ctx.save();

    // Clip to body shape so bands don't extend beyond
    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.clip();

    for (let b = 0; b < bandCount; b++) {
      const t = 0.15 + (b / (bandCount - 1)) * 0.55; // Position along body (15%-70%)

      // Get position on spine
      const pos = spine.getPositionAt(t);
      const perpAngle = pos.angle - Math.PI / 2;

      // Draw vertical band - stays within body due to clipping
      ctx.beginPath();

      const topX = pos.x + Math.cos(perpAngle) * pos.width * 0.95;
      const topY = pos.y + Math.sin(perpAngle) * pos.width * 0.95;
      const bottomX = pos.x - Math.cos(perpAngle) * pos.width * 0.95;
      const bottomY = pos.y - Math.sin(perpAngle) * pos.width * 0.95;

      ctx.moveTo(topX, topY);
      ctx.lineTo(bottomX, bottomY);

      ctx.strokeStyle = bandColors[b % bandColors.length]!;
      ctx.lineWidth = bandWidth * (1 - Math.abs(t - 0.4) * 0.6);
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.75;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw horizontal racing stripes for schooling fish
   */
  drawHorizontalStripes(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const stripeCount = 2;
    const stripeWidth = fish.bodyHeight * 0.12; // Thicker

    for (let s = 0; s < stripeCount; s++) {
      const t = s === 0 ? 0.3 : 0.7; // Top and bottom stripes

      ctx.beginPath();

      for (let i = 0; i < spine.joints.length; i++) {
        const joint = spine.joints[i]!;
        const perpAngle = joint.angle - Math.PI / 2;
        const offset = (t - 0.5) * joint.width * 1.4;
        const x = joint.x + Math.cos(perpAngle) * offset;
        const y = joint.y + Math.sin(perpAngle) * offset;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }

      // Bold metallic stripe
      const gradient = ctx.createLinearGradient(
        spine.joints[0]!.x, spine.joints[0]!.y,
        spine.joints[spine.joints.length - 1]!.x, spine.joints[spine.joints.length - 1]!.y
      );
      gradient.addColorStop(0, this.colorCalc.adjustAlpha(fish.colors.accent, 0.9));
      gradient.addColorStop(0.5, "#ffffff");
      gradient.addColorStop(1, this.colorCalc.adjustAlpha(fish.colors.accent, 0.9));

      ctx.strokeStyle = gradient;
      ctx.lineWidth = stripeWidth;
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.8;
      ctx.stroke();
    }
  }

  /**
   * Draw decorative spot patterns for deep and sleek fish
   */
  drawSpineSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    // Deep fish get glowing spots, sleek fish get subtle markings
    if (fish.species !== "deep" && fish.species !== "sleek") return;

    ctx.save();

    // Use a seeded random based on fish position for consistent spots
    const seed = Math.floor(fish.x * 1000 + fish.y * 100);

    if (fish.species === "deep") {
      // Deep fish: Small glowing spots along body
      const spotCount = 6;
      for (let i = 0; i < spotCount; i++) {
        const pseudoRandom = Math.sin(seed + i * 12.9898) * 43758.5453 % 1;
        const t = 0.2 + pseudoRandom * 0.6;
        const pos = spine.getPositionAt(t);

        const perpAngle = pos.angle - Math.PI / 2;
        const offsetAmount = (Math.sin(seed + i * 7.234) * 0.5) * pos.width * 0.6;
        const x = pos.x + Math.cos(perpAngle) * offsetAmount;
        const y = pos.y + Math.sin(perpAngle) * offsetAmount;

        const spotSize = fish.bodyHeight * (0.03 + Math.abs(Math.sin(seed + i * 3.14)) * 0.02);
        const spotPhase = fish.glowPhase + i * 0.8;
        const intensity = 0.3 + Math.sin(spotPhase) * 0.2;

        const gradient = ctx.createRadialGradient(x, y, 0, x, y, spotSize);
        gradient.addColorStop(0, this.colorCalc.adjustAlpha(fish.colors.accent, intensity));
        gradient.addColorStop(0.5, this.colorCalc.adjustAlpha(fish.colors.accent, intensity * 0.3));
        gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(x, y, spotSize, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Sleek fish: Subtle darker spots/markings
      const spotCount = 4;
      ctx.globalAlpha = 0.2;

      for (let i = 0; i < spotCount; i++) {
        const pseudoRandom = Math.sin(seed + i * 12.9898) * 43758.5453 % 1;
        const t = 0.25 + pseudoRandom * 0.5;
        const pos = spine.getPositionAt(t);

        const perpAngle = pos.angle - Math.PI / 2;
        const offsetAmount = (Math.sin(seed + i * 5.67) * 0.3) * pos.width * 0.5;
        const x = pos.x + Math.cos(perpAngle) * offsetAmount;
        const y = pos.y + Math.sin(perpAngle) * offsetAmount;

        const spotSize = fish.bodyHeight * (0.04 + Math.abs(Math.sin(seed + i * 2.71)) * 0.03);

        ctx.fillStyle = this.colorCalc.adjustBrightness(fish.colors.bodyTop, -30);
        ctx.beginPath();
        ctx.ellipse(x, y, spotSize * 1.5, spotSize, pos.angle, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  /**
   * Draw iridescent shimmer highlight on body - AMPLIFIED for A+ visuals
   */
  drawSpineIridescence(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void {
    ctx.save();

    // Create shimmer highlight along the upper body - MUCH stronger
    const shimmerPhase = fish.scalePhase * 3;
    const shimmerIntensity = 0.35 + Math.sin(shimmerPhase) * 0.2; // Doubled intensity

    const centerX = (outline.headPoint.x + outline.tailPoint.x) / 2;
    const topY = Math.min(...outline.leftPoints.map(p => p.y), ...outline.rightPoints.map(p => p.y));
    const bottomY = Math.max(...outline.leftPoints.map(p => p.y), ...outline.rightPoints.map(p => p.y));
    const centerY = (outline.headPoint.y + outline.tailPoint.y) / 2;

    // Multiple overlapping iridescent layers for rainbow effect
    const hue1 = (fish.scalePhase * 50) % 360;
    const hue2 = (hue1 + 60) % 360;
    const hue3 = (hue1 + 120) % 360;

    // Layer 1: Primary shimmer from top
    const gradient1 = ctx.createLinearGradient(centerX, topY, centerX, centerY);
    gradient1.addColorStop(0, `hsla(${hue1}, 100%, 85%, ${shimmerIntensity})`);
    gradient1.addColorStop(0.4, `hsla(${hue2}, 90%, 75%, ${shimmerIntensity * 0.6})`);
    gradient1.addColorStop(1, `hsla(${hue3}, 80%, 70%, 0)`);

    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.fillStyle = gradient1;
    ctx.fill();

    // Layer 2: Traveling wave shimmer (moves along body)
    const waveOffset = (fish.scalePhase * 0.3) % 1;
    const waveX = outline.headPoint.x + (outline.tailPoint.x - outline.headPoint.x) * waveOffset;

    const waveGradient = ctx.createRadialGradient(
      waveX, centerY, 0,
      waveX, centerY, fish.bodyLength * 0.3
    );
    waveGradient.addColorStop(0, `hsla(${hue2}, 100%, 90%, ${shimmerIntensity * 0.7})`);
    waveGradient.addColorStop(0.5, `hsla(${hue3}, 80%, 80%, ${shimmerIntensity * 0.3})`);
    waveGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.fillStyle = waveGradient;
    ctx.fill();

    // Layer 3: Strong specular highlight (wet look)
    const highlightX = outline.headPoint.x + (outline.tailPoint.x - outline.headPoint.x) * 0.25;
    const highlightY = topY + fish.bodyHeight * 0.15;
    const highlightRadius = fish.bodyHeight * 0.4;

    const specularGradient = ctx.createRadialGradient(
      highlightX, highlightY, 0,
      highlightX, highlightY, highlightRadius
    );
    specularGradient.addColorStop(0, `rgba(255, 255, 255, ${shimmerIntensity * 1.2})`);
    specularGradient.addColorStop(0.3, `rgba(255, 255, 255, ${shimmerIntensity * 0.6})`);
    specularGradient.addColorStop(0.7, `rgba(200, 230, 255, ${shimmerIntensity * 0.2})`);
    specularGradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.fillStyle = specularGradient;
    ctx.fill();

    // Layer 4: Belly shimmer (subtle light from below)
    const bellyGradient = ctx.createLinearGradient(centerX, centerY, centerX, bottomY);
    bellyGradient.addColorStop(0, "rgba(255, 255, 255, 0)");
    bellyGradient.addColorStop(0.5, `rgba(200, 220, 255, ${shimmerIntensity * 0.15})`);
    bellyGradient.addColorStop(1, `rgba(180, 200, 255, ${shimmerIntensity * 0.25})`);

    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.fillStyle = bellyGradient;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw lateral line along spine
   */
  drawSpineLateralLine(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    if (spine.joints.length < 3) return;

    ctx.save();

    // Draw dashed lateral line
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.3);
    ctx.lineWidth = 1;
    ctx.setLineDash([fish.bodyLength * 0.03, fish.bodyLength * 0.02]);

    ctx.beginPath();

    // Line runs along the middle of the body, slightly offset
    for (let i = 1; i < spine.joints.length - 1; i++) {
      const joint = spine.joints[i]!;
      const perpAngle = joint.angle - Math.PI / 2;

      // Slightly above center (negative Y offset)
      const x = joint.x + Math.cos(perpAngle) * joint.width * 0.1;
      const y = joint.y + Math.sin(perpAngle) * joint.width * 0.1;

      if (i === 1) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }



  // ===========================================================================
  // LEGACY RENDERING (Static Bezier)
  // ===========================================================================

  drawSingleFish(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife
  ): void {
    ctx.save();
    ctx.globalAlpha = fish.opacity;
    ctx.translate(fish.x, fish.y);
    ctx.rotate(fish.rotation);
    // Flip horizontally: direction=1 means moving right, so head should point right (positive X)
    // Body is drawn with nose at -0.5, so we need to flip based on direction
    ctx.scale(-fish.direction, 1);

    const len = fish.bodyLength;
    const height = fish.bodyHeight;

    // Draw layers back to front
    this.effectRenderer.drawWakeTrail(ctx, fish);
    this.effectRenderer.drawBioluminescenceGlow(ctx, fish, len, height);
    this.drawBody(ctx, fish, len, height);
    this.drawScalePattern(ctx, fish, len, height);
    this.drawLateralLine(ctx, fish, len, height);
    this.finRenderer.drawFins(ctx, fish, len, height);
    this.faceRenderer.drawGill(ctx, fish, len, height);
    this.faceRenderer.drawEye(ctx, fish, len, height);
    this.effectRenderer.drawBioluminescenceSpots(ctx, fish, len, height);

    ctx.restore();
  }

  // ===========================================================================
  // BODY
  // ===========================================================================

  drawBody(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const shape = SPECIES_SHAPE[fish.species];
    const colors = fish.colors;

    // Apply body flex (S-curve deformation)
    const flexAmount =
      Math.sin(fish.bodyFlexPhase) * fish.bodyFlexAmount * height * 0.5;

    // Create body path
    ctx.beginPath();

    // Get modified control points
    const dorsalPoints = RENDER_CONFIG.bodyShape.dorsalControlPoints.map(
      (p: { x: number; y: number }) => ({
        x: p.x * len,
        y: p.y * height * shape.dorsalMod + this.getFlexOffset(p.x, flexAmount),
      })
    );

    const ventralPoints = RENDER_CONFIG.bodyShape.ventralControlPoints.map(
      (p: { x: number; y: number }) => ({
        x: p.x * len,
        y:
          p.y * height * shape.ventralMod + this.getFlexOffset(p.x, flexAmount),
      })
    );

    // Draw dorsal curve (top)
    ctx.moveTo(dorsalPoints[0]!.x, dorsalPoints[0]!.y);
    for (let i = 1; i < dorsalPoints.length; i++) {
      const prev = dorsalPoints[i - 1]!;
      const curr = dorsalPoints[i]!;
      const cpX = (prev.x + curr.x) / 2;
      ctx.quadraticCurveTo(prev.x + (curr.x - prev.x) * 0.5, prev.y, cpX, (prev.y + curr.y) / 2);
    }

    // Continue to last dorsal point
    const lastDorsal = dorsalPoints[dorsalPoints.length - 1]!;
    ctx.lineTo(lastDorsal.x, lastDorsal.y);

    // Draw ventral curve (bottom) in reverse
    for (let i = ventralPoints.length - 1; i >= 0; i--) {
      const curr = ventralPoints[i]!;
      const next = i > 0 ? ventralPoints[i - 1]! : curr;
      const cpX = (curr.x + next.x) / 2;
      ctx.quadraticCurveTo(
        curr.x - (curr.x - next.x) * 0.5,
        curr.y,
        cpX,
        (curr.y + next.y) / 2
      );
    }

    ctx.closePath();

    // Body gradient (top to bottom)
    const gradient = ctx.createLinearGradient(
      0,
      -height * 0.5,
      0,
      height * 0.5
    );
    gradient.addColorStop(0, colors.bodyTop);
    gradient.addColorStop(0.4, this.colorCalc.blendColors(colors.bodyTop, colors.bodyBottom, 0.3));
    gradient.addColorStop(1, colors.bodyBottom);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = this.colorCalc.adjustAlpha(colors.bodyTop, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  getFlexOffset(xFraction: number, flexAmount: number): number {
    // S-curve: positive at front, negative at back
    return Math.sin(xFraction * Math.PI * 2) * flexAmount;
  }

  // ===========================================================================
  // SCALE PATTERN
  // ===========================================================================

  drawScalePattern(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = RENDER_CONFIG.scales;
    const shimmer = Math.sin(fish.scalePhase) * config.shimmerIntensity;

    ctx.save();
    ctx.globalAlpha = 0.15 + shimmer;

    const scaleSize = height * config.size;
    const startX = -len * 0.4;
    const endX = len * 0.35;
    const rowSpacing = (height * 0.7) / config.rows;

    for (let row = 0; row < config.rows; row++) {
      const y = -height * 0.35 + row * rowSpacing;
      const offsetX = (row % 2) * scaleSize * 0.5; // Stagger rows

      for (let col = 0; col < config.perRow; col++) {
        const x = startX + offsetX + col * scaleSize * 0.9;
        if (x > endX) break;

        // Scale shimmer based on position and phase
        const localShimmer =
          Math.sin(fish.scalePhase + x * 0.1 + y * 0.05) * 0.1;

        ctx.fillStyle = this.colorCalc.adjustAlpha(
          fish.colors.accent,
          0.1 + localShimmer
        );

        // Draw crescent-shaped scale
        ctx.beginPath();
        ctx.arc(x, y, scaleSize, Math.PI * 0.2, Math.PI * 0.8);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // ===========================================================================
  // LATERAL LINE
  // ===========================================================================

  drawLateralLine(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = RENDER_CONFIG.lateralLine;
    const y = height * config.yOffset;

    ctx.save();
    ctx.strokeStyle = this.colorCalc.adjustAlpha(fish.colors.accent, 0.25);
    ctx.lineWidth = 1;
    ctx.setLineDash([len * config.dashLength, len * config.gapLength]);

    ctx.beginPath();
    ctx.moveTo(-len * 0.35, y);
    ctx.lineTo(len * 0.35, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

}
