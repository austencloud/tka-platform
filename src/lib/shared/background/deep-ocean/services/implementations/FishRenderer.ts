import { injectable } from "inversify";
import type {
  FishMarineLife,
  FishSpecies,
  FinState,
  TailState,
  FishColorPalette,
  SpineFin,
} from "../../domain/models/DeepOceanModels";
import type { IFishRenderer } from "../contracts/IFishRenderer";
import { SpineChain } from "../../physics/SpineChain";
import { BodyOutlineCalculator, type Point } from "../../physics/BodyOutlineCalculator";

/**
 * Fish Rendering Configuration
 *
 * Anatomically accurate procedural fish rendering with:
 * - Bezier body curves
 * - Animated fins with physics
 * - Scale shimmer patterns
 * - Eye details
 * - Gill animation
 * - Bioluminescence (deep species)
 * - Wake trails
 */
const RENDER_CONFIG = {
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

  // Eye positioning
  eye: {
    xOffset: -0.32, // From center, toward nose
    yOffset: -0.1, // Slightly above centerline
    pupilSize: 0.4, // Relative to eye size
    highlightSize: 0.2,
    highlightOffset: { x: -0.2, y: -0.25 },
  },

  // Gill positioning
  gill: {
    xOffset: -0.15,
    yOffset: 0.05,
    length: 0.12, // Relative to body height
    openAmount: 0.3, // Base opening
  },

  // Fin attachment points
  fins: {
    dorsal: { x: -0.05, y: -0.5 },
    pectoralTop: { x: -0.15, y: -0.15 },
    pectoralBottom: { x: -0.1, y: 0.2 },
    pelvic: { x: 0.1, y: 0.35 },
    anal: { x: 0.25, y: 0.35 },
    tail: { x: 0.45, y: 0 },
  },

  // Scale pattern
  scales: {
    rows: 5,
    perRow: 12,
    size: 0.08, // Relative to body height
    shimmerIntensity: 0.15,
  },

  // Lateral line
  lateralLine: {
    yOffset: 0.05, // Slightly below center
    dashLength: 0.03,
    gapLength: 0.02,
  },

  // Wake trail
  wake: {
    color: "rgba(180, 220, 255, 0.3)",
  },

  // Bioluminescence
  glow: {
    spotCount: 5,
    spotSize: [0.02, 0.05] as [number, number],
    colors: ["#00fff7", "#7b68ee", "#00ced1"],
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

@injectable()
export class FishRenderer implements IFishRenderer {
  private bodyOutlineCalculator = new BodyOutlineCalculator();

  drawFish(ctx: CanvasRenderingContext2D, fish: FishMarineLife[]): void {
    // Sort by depth layer for proper z-ordering (far first, near last)
    const sorted = [...fish].sort((a, b) => {
      const order = { far: 0, mid: 1, near: 2 };
      return order[a.depthLayer] - order[b.depthLayer];
    });

    for (const f of sorted) {
      if (f.useSpineChain && f.spineJoints) {
        this.drawSpineChainFish(ctx, f);
      } else {
        this.drawSingleFish(ctx, f);
      }
    }
  }

  // ===========================================================================
  // SPINE-CHAIN RENDERING (Organic Animation)
  // ===========================================================================

  /**
   * Draw fish using spine chain data for organic body shape
   */
  private drawSpineChainFish(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife
  ): void {
    if (!fish.spineJoints || fish.spineJoints.length === 0) return;

    ctx.save();
    ctx.globalAlpha = fish.opacity;

    // Create temporary spine chain from joint data for outline calculation
    const tempSpine = this.createTempSpineFromJoints(fish);
    const outline = this.bodyOutlineCalculator.calculateOutline(tempSpine);

    // Draw wake trail (in world space)
    this.drawWakeTrail(ctx, fish);

    // Draw bioluminescence glow
    if (fish.hasBioluminescence && fish.glowIntensity > 0) {
      this.drawSpineBioluminescenceGlow(ctx, fish, outline);
    }

    // Draw body from spine outline
    this.drawSpineBody(ctx, fish, outline);

    // Draw stripe patterns (tropical/schooling)
    this.drawSpineStripes(ctx, fish, tempSpine);

    // Draw spot patterns (deep/sleek)
    this.drawSpineSpots(ctx, fish, tempSpine);

    // Draw scale pattern on spine body
    this.drawSpineScalePattern(ctx, fish, tempSpine);

    // Draw iridescent shimmer highlight
    this.drawSpineIridescence(ctx, fish, outline);

    // Draw lateral line
    this.drawSpineLateralLine(ctx, fish, tempSpine);

    // Draw fins attached to spine
    if (fish.spineFins) {
      this.drawSpineFins(ctx, fish, tempSpine);
    }

    // Draw eye at head position
    this.drawSpineEye(ctx, fish, tempSpine);

    // Draw gill slit
    this.drawSpineGill(ctx, fish, tempSpine);

    // Draw bioluminescence spots
    if (fish.hasBioluminescence && fish.glowIntensity > 0) {
      this.drawSpineBioluminescenceSpots(ctx, fish, tempSpine);
    }

    ctx.restore();
  }

  /**
   * Create temporary SpineChain object from joint data
   */
  private createTempSpineFromJoints(fish: FishMarineLife): SpineChain {
    // Create a minimal SpineChain-like object for the body outline calculator
    const spineConfig = fish.spineConfig ?? {
      jointCount: fish.spineJoints!.length,
      widthProfile: fish.spineJoints!.map((j) => j.width),
      angleConstraint: Math.PI / 8,
      segmentLength: fish.bodyLength / (fish.spineJoints!.length - 1),
    };

    const tempSpine = new SpineChain(
      spineConfig,
      fish.spineJoints![0]!.x,
      fish.spineJoints![0]!.y,
      fish.direction
    );

    // Copy actual joint positions
    for (let i = 0; i < fish.spineJoints!.length && i < tempSpine.joints.length; i++) {
      const source = fish.spineJoints![i]!;
      const target = tempSpine.joints[i]!;
      target.x = source.x;
      target.y = source.y;
      target.angle = source.angle;
      target.width = source.width;
    }

    return tempSpine;
  }

  /**
   * Draw body from spine outline with gradient
   */
  private drawSpineBody(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void {
    const { leftPoints, rightPoints, headPoint, tailPoint } = outline;
    if (leftPoints.length < 2) return;

    // Calculate bounds for gradient
    let minY = Infinity, maxY = -Infinity;
    for (const p of leftPoints) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }
    for (const p of rightPoints) {
      minY = Math.min(minY, p.y);
      maxY = Math.max(maxY, p.y);
    }

    // Draw body path
    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);

    // Body gradient (top to bottom)
    const gradient = ctx.createLinearGradient(0, minY, 0, maxY);
    gradient.addColorStop(0, fish.colors.bodyTop);
    gradient.addColorStop(0.4, this.blendColors(fish.colors.bodyTop, fish.colors.bodyBottom, 0.3));
    gradient.addColorStop(1, fish.colors.bodyBottom);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = this.adjustAlpha(fish.colors.bodyTop, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw scale pattern on spine-based body
   */
  private drawSpineScalePattern(
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
        ctx.fillStyle = this.adjustAlpha(fish.colors.accent, 0.1 + localShimmer);

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
  private drawSpineStripes(
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
  private drawVerticalBands(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const bandCount = 3 + Math.floor(Math.random() * 2); // 3-4 bands
    const bandWidth = fish.bodyLength * 0.08;

    // Use contrasting colors for bands
    const bandColors = [
      fish.colors.accent,
      this.shiftHue(fish.colors.accent, 180), // Complementary
      "#ffffff",
      fish.colors.accent,
    ];

    for (let b = 0; b < bandCount; b++) {
      const t = 0.2 + (b / (bandCount - 1)) * 0.5; // Position along body (20%-70%)

      // Get position on spine
      const pos = spine.getPositionAt(t);
      const perpAngle = pos.angle - Math.PI / 2;

      // Draw vertical band from top to bottom of body at this point
      ctx.beginPath();

      const topX = pos.x + Math.cos(perpAngle) * pos.width * 1.1;
      const topY = pos.y + Math.sin(perpAngle) * pos.width * 1.1;
      const bottomX = pos.x - Math.cos(perpAngle) * pos.width * 1.1;
      const bottomY = pos.y - Math.sin(perpAngle) * pos.width * 1.1;

      ctx.moveTo(topX, topY);
      ctx.lineTo(bottomX, bottomY);

      ctx.strokeStyle = bandColors[b % bandColors.length]!;
      ctx.lineWidth = bandWidth * (1 - Math.abs(t - 0.45) * 0.8);
      ctx.lineCap = "round";
      ctx.globalAlpha = 0.7;
      ctx.stroke();

      // Add edge glow for pop
      ctx.strokeStyle = this.adjustAlpha(bandColors[b % bandColors.length]!, 0.3);
      ctx.lineWidth = bandWidth * 1.5;
      ctx.globalAlpha = 0.3;
      ctx.stroke();
    }
  }

  /**
   * Draw horizontal racing stripes for schooling fish
   */
  private drawHorizontalStripes(
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
      gradient.addColorStop(0, this.adjustAlpha(fish.colors.accent, 0.9));
      gradient.addColorStop(0.5, "#ffffff");
      gradient.addColorStop(1, this.adjustAlpha(fish.colors.accent, 0.9));

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
  private drawSpineSpots(
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
        gradient.addColorStop(0, this.adjustAlpha(fish.colors.accent, intensity));
        gradient.addColorStop(0.5, this.adjustAlpha(fish.colors.accent, intensity * 0.3));
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

        ctx.fillStyle = this.adjustBrightness(fish.colors.bodyTop, -30);
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
  private drawSpineIridescence(
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
  private drawSpineLateralLine(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    if (spine.joints.length < 3) return;

    ctx.save();

    // Draw dashed lateral line
    ctx.strokeStyle = this.adjustAlpha(fish.colors.accent, 0.3);
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

  /**
   * Shift hue of a color
   */
  private shiftHue(color: string, degrees: number): string {
    const rgb = this.hexToRgb(color);

    // Convert RGB to HSL
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }

    // Shift hue
    h = (h + degrees / 360) % 1;
    if (h < 0) h += 1;

    return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
  }

  /**
   * Draw fins attached to spine segments
   */
  private drawSpineFins(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    if (!fish.spineFins) return;

    for (const fin of fish.spineFins) {
      if (fin.attachmentSegment >= spine.joints.length) continue;

      const joint = spine.joints[fin.attachmentSegment]!;
      const curvature = spine.getCurvatureAt(fin.attachmentSegment);

      // Calculate fin position
      // In canvas coords: +Y is DOWN, so "top" needs negative Y offset
      // For angle=0 (facing right): perpendicular UP is -PI/2
      const perpAngleUp = joint.angle - Math.PI / 2; // Points UP (negative Y)
      let attachX = joint.x;
      let attachY = joint.y;

      // Offset based on side (using perpAngleUp for top/bottom)
      switch (fin.attachmentSide) {
        case "top":
          // Top fin: offset in UP direction (negative Y)
          attachX += Math.cos(perpAngleUp) * joint.width;
          attachY += Math.sin(perpAngleUp) * joint.width;
          break;
        case "bottom":
          // Bottom fin: offset in DOWN direction (opposite of up)
          attachX -= Math.cos(perpAngleUp) * joint.width;
          attachY -= Math.sin(perpAngleUp) * joint.width;
          break;
        case "left":
          // Left pectoral: slightly above center (viewer's perspective)
          attachX += Math.cos(perpAngleUp) * joint.width * 0.3;
          attachY += Math.sin(perpAngleUp) * joint.width * 0.3;
          break;
        case "right":
          // Right pectoral: slightly below center (viewer's perspective)
          attachX -= Math.cos(perpAngleUp) * joint.width * 0.3;
          attachY -= Math.sin(perpAngleUp) * joint.width * 0.3;
          break;
      }

      // Calculate fin angle with curvature response
      const finAngle = joint.angle + fin.baseAngle + curvature * fin.curvatureResponse * 2;

      this.drawSpineFin(
        ctx,
        attachX,
        attachY,
        finAngle,
        fin.length * fish.bodyLength,
        fin.width * fish.bodyHeight,
        fin.segments,
        fish.colors
      );
    }

    // Draw tail fin separately (at last joint)
    this.drawSpineTailFin(ctx, fish, spine);
  }

  /**
   * Draw a single fin attached to spine
   */
  private drawSpineFin(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    angle: number,
    length: number,
    width: number,
    segments: number,
    colors: FishColorPalette
  ): void {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);

    // Draw fin as curved triangle
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(length * 0.3, -width * 0.3, length, 0);
    ctx.quadraticCurveTo(length * 0.6, width * 0.4, 0, width * 0.1);
    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    gradient.addColorStop(0, colors.finTint);
    gradient.addColorStop(1, this.adjustAlpha(colors.finTint, 0.2));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Fin rays
    ctx.strokeStyle = this.adjustAlpha(colors.accent, 0.2);
    ctx.lineWidth = 0.5;
    for (let i = 1; i < segments; i++) {
      const t = i / segments;
      ctx.beginPath();
      ctx.moveTo(0, width * 0.05 * t);
      ctx.lineTo(length * (1 - t * 0.3), 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw tail fin at end of spine
   */
  private drawSpineTailFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const tail = spine.joints[spine.joints.length - 1]!;
    const prevTail = spine.joints[spine.joints.length - 2];
    if (!prevTail) return;

    const tailLen = fish.tailFin.length * fish.bodyLength;
    const tailWidth = fish.tailFin.width * fish.bodyHeight;
    const forkDepth = fish.tailFin.forkDepth * tailLen;
    const forkSpread = fish.tailFin.forkAngle;

    ctx.save();
    ctx.translate(tail.x, tail.y);
    // Tail fin extends AWAY from head (opposite to body direction)
    // Calculate angle from previous joint to tail (direction the tail came from)
    const awayAngle = Math.atan2(tail.y - prevTail.y, tail.x - prevTail.x);
    ctx.rotate(awayAngle);

    // Draw forked tail
    ctx.beginPath();

    // Top fork
    ctx.moveTo(0, -tailWidth * 0.1);
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      -tailWidth * 0.2 - forkSpread * tailWidth,
      tailLen,
      -tailWidth * forkSpread
    );

    // Fork indent
    ctx.quadraticCurveTo(tailLen - forkDepth, 0, tailLen, tailWidth * forkSpread);

    // Bottom fork
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      tailWidth * 0.2 + forkSpread * tailWidth,
      0,
      tailWidth * 0.1
    );

    ctx.closePath();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, tailLen, 0);
    gradient.addColorStop(0, fish.colors.finTint);
    gradient.addColorStop(0.7, this.adjustAlpha(fish.colors.finTint, 0.5));
    gradient.addColorStop(1, this.adjustAlpha(fish.colors.accent, 0.3));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Tail rays
    ctx.strokeStyle = this.adjustAlpha(fish.colors.accent, 0.15);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < fish.tailFin.segments; i++) {
      const t = i / fish.tailFin.segments - 0.5;
      const spread = t * forkSpread * tailWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, t * tailWidth * 0.2);
      ctx.quadraticCurveTo(tailLen * 0.5, spread * 0.5, tailLen * 0.9, spread);
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw eye at head position on spine
   */
  private drawSpineEye(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    const head = spine.joints[0]!;
    const second = spine.joints[1];
    if (!second) return;

    // Position eye relative to head
    // Eye is slightly back from nose and above center line
    // In canvas coords: +Y is DOWN, so UP is -PI/2 perpendicular
    const perpAngleUp = head.angle - Math.PI / 2; // Points UP (negative Y)
    const eyeOffset = 0.12 * fish.bodyLength; // How far back from nose
    // Calculate direction from head toward second joint (backward along body)
    const backwardAngle = Math.atan2(second.y - head.y, second.x - head.x);
    const eyeX = head.x + Math.cos(backwardAngle) * eyeOffset + Math.cos(perpAngleUp) * head.width * 0.4;
    const eyeY = head.y + Math.sin(backwardAngle) * eyeOffset + Math.sin(perpAngleUp) * head.width * 0.4;
    const eyeRadius = Math.max(fish.eyeSize * fish.bodyHeight, 3); // Minimum 3px radius

    // Eye socket
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = this.adjustAlpha(fish.colors.bodyTop, 0.8);
    ctx.fill();

    // Eyeball
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const eyeGradient = ctx.createRadialGradient(
      eyeX - eyeRadius * 0.2,
      eyeY - eyeRadius * 0.2,
      0,
      eyeX,
      eyeY,
      eyeRadius
    );
    eyeGradient.addColorStop(0, "#ffffff");
    eyeGradient.addColorStop(0.7, "#e8e8e8");
    eyeGradient.addColorStop(1, "#cccccc");
    ctx.fillStyle = eyeGradient;
    ctx.fill();

    // Iris
    const irisRadius = eyeRadius * 0.65;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, irisRadius, 0, Math.PI * 2);
    const irisGradient = ctx.createRadialGradient(eyeX, eyeY, 0, eyeX, eyeY, irisRadius);
    irisGradient.addColorStop(0, fish.colors.eye);
    irisGradient.addColorStop(0.8, this.adjustBrightness(fish.colors.eye, -20));
    irisGradient.addColorStop(1, this.adjustBrightness(fish.colors.eye, -40));
    ctx.fillStyle = irisGradient;
    ctx.fill();

    // Pupil
    const pupilRadius = eyeRadius * 0.4;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Highlight
    ctx.beginPath();
    ctx.arc(eyeX - eyeRadius * 0.2, eyeY - eyeRadius * 0.25, eyeRadius * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();
  }

  /**
   * Draw gill slit on spine body
   */
  private drawSpineGill(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    if (spine.joints.length < 2) return;

    const joint = spine.joints[1]!; // Second joint (near head)
    const gillLen = 0.12 * fish.bodyHeight;
    const openAmount = 0.3 + Math.sin(fish.gillPhase) * 0.15;

    const perpAngle = joint.angle + Math.PI / 2;
    const gillX = joint.x + Math.cos(perpAngle) * joint.width * 0.2;
    const gillY = joint.y + Math.sin(perpAngle) * joint.width * 0.2;

    ctx.save();
    ctx.translate(gillX, gillY);
    ctx.rotate(joint.angle);

    // Draw gill slit
    ctx.beginPath();
    ctx.moveTo(0, -gillLen * 0.5);
    ctx.quadraticCurveTo(openAmount * fish.bodyHeight * 0.1, 0, 0, gillLen * 0.5);
    ctx.strokeStyle = this.adjustAlpha(fish.colors.bodyTop, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner gill
    if (openAmount > 0.2) {
      ctx.beginPath();
      ctx.moveTo(openAmount * fish.bodyHeight * 0.02, -gillLen * 0.4);
      ctx.quadraticCurveTo(
        openAmount * fish.bodyHeight * 0.08,
        0,
        openAmount * fish.bodyHeight * 0.02,
        gillLen * 0.4
      );
      ctx.strokeStyle = `rgba(180, 80, 80, ${openAmount * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw bioluminescence glow around spine body - DRAMATIC A+ glow
   */
  private drawSpineBioluminescenceGlow(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    outline: { leftPoints: Point[]; rightPoints: Point[]; headPoint: Point; tailPoint: Point }
  ): void {
    const centerX = (outline.headPoint.x + outline.tailPoint.x) / 2;
    const centerY = (outline.headPoint.y + outline.tailPoint.y) / 2;

    // Pulsing glow intensity
    const pulseIntensity = fish.glowIntensity * (0.7 + Math.sin(fish.glowPhase * 2) * 0.3);

    // Layer 1: Large outer glow
    const outerRadius = Math.max(fish.bodyLength, fish.bodyHeight) * 1.2;
    const rgb = this.hexToRgb(fish.colors.accent);

    const outerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
    outerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.5})`);
    outerGradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.25})`);
    outerGradient.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.1})`);
    outerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = outerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 2: Inner intense glow
    const innerRadius = Math.max(fish.bodyLength, fish.bodyHeight) * 0.5;
    const innerGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    innerGradient.addColorStop(0, `rgba(255, 255, 255, ${pulseIntensity * 0.4})`);
    innerGradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${pulseIntensity * 0.6})`);
    innerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fill();

    // Layer 3: Edge glow along body outline
    ctx.save();
    ctx.shadowColor = fish.colors.accent;
    ctx.shadowBlur = 15 * pulseIntensity;
    ctx.strokeStyle = this.adjustAlpha(fish.colors.accent, pulseIntensity * 0.5);
    ctx.lineWidth = 3;
    this.bodyOutlineCalculator.drawBodyPath(ctx, outline);
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw bioluminescence spots along spine - DRAMATIC A+ spots
   */
  private drawSpineBioluminescenceSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    spine: SpineChain
  ): void {
    // More spots, more variety
    const spotCount = 8;
    const colors = ["#00fff7", "#7b68ee", "#00ced1", "#ff00ff", "#00ff88"];

    ctx.save();

    for (let i = 0; i < spotCount; i++) {
      const t = (i + 0.5) / (spotCount);
      const pos = spine.getPositionAt(t);

      // Offset spots from centerline
      const perpAngle = pos.angle - Math.PI / 2;
      const offsetDir = (i % 2 === 0) ? 1 : -1;
      const offsetAmount = pos.width * 0.3 * offsetDir;
      const spotX = pos.x + Math.cos(perpAngle) * offsetAmount;
      const spotY = pos.y + Math.sin(perpAngle) * offsetAmount;

      // Cascading pulse effect
      const spotPhase = fish.glowPhase + i * 0.4;
      const spotIntensity = fish.glowIntensity * (0.6 + Math.sin(spotPhase) * 0.4);

      const spotSize = fish.bodyHeight * (0.04 + Math.sin(spotPhase * 0.5) * 0.02);
      const color = colors[i % colors.length]!;
      const rgb = this.hexToRgb(color);

      // Outer glow
      const outerGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize * 2);
      outerGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity})`);
      outerGradient.addColorStop(0.4, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity * 0.5})`);
      outerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = outerGradient;
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotSize * 2, 0, Math.PI * 2);
      ctx.fill();

      // Bright center
      const centerGradient = ctx.createRadialGradient(spotX, spotY, 0, spotX, spotY, spotSize * 0.5);
      centerGradient.addColorStop(0, `rgba(255, 255, 255, ${spotIntensity})`);
      centerGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity * 0.8})`);

      ctx.fillStyle = centerGradient;
      ctx.beginPath();
      ctx.arc(spotX, spotY, spotSize * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add glowing "antenna" lure for anglerfish effect
    const headPos = spine.getPositionAt(0.05);
    const lurePhase = fish.glowPhase * 1.5;
    const lureIntensity = fish.glowIntensity * (0.5 + Math.sin(lurePhase) * 0.5);

    if (lureIntensity > 0.3) {
      const lureX = headPos.x + Math.cos(headPos.angle - Math.PI / 4) * fish.bodyHeight * 0.3;
      const lureY = headPos.y + Math.sin(headPos.angle - Math.PI / 4) * fish.bodyHeight * 0.3;
      const lureSize = fish.bodyHeight * 0.08;

      // Lure glow
      const lureGradient = ctx.createRadialGradient(lureX, lureY, 0, lureX, lureY, lureSize * 3);
      lureGradient.addColorStop(0, `rgba(255, 255, 255, ${lureIntensity})`);
      lureGradient.addColorStop(0.2, `rgba(0, 255, 255, ${lureIntensity * 0.8})`);
      lureGradient.addColorStop(0.5, `rgba(0, 200, 255, ${lureIntensity * 0.4})`);
      lureGradient.addColorStop(1, "rgba(0, 150, 255, 0)");

      ctx.fillStyle = lureGradient;
      ctx.beginPath();
      ctx.arc(lureX, lureY, lureSize * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ===========================================================================
  // LEGACY RENDERING (Static Bezier)
  // ===========================================================================

  private drawSingleFish(
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
    this.drawWakeTrail(ctx, fish);
    this.drawBioluminescenceGlow(ctx, fish, len, height);
    this.drawBody(ctx, fish, len, height);
    this.drawScalePattern(ctx, fish, len, height);
    this.drawLateralLine(ctx, fish, len, height);
    this.drawFins(ctx, fish, len, height);
    this.drawGill(ctx, fish, len, height);
    this.drawEye(ctx, fish, len, height);
    this.drawBioluminescenceSpots(ctx, fish, len, height);

    ctx.restore();
  }

  // ===========================================================================
  // WAKE TRAIL
  // ===========================================================================

  private drawWakeTrail(ctx: CanvasRenderingContext2D, fish: FishMarineLife): void {
    if (fish.wakeTrail.length === 0) return;

    ctx.save();
    // Wake is in world space, need to undo fish transform
    ctx.scale(fish.direction, 1);
    ctx.rotate(-fish.rotation);
    ctx.translate(-fish.x, -fish.y);

    for (const particle of fish.wakeTrail) {
      if (particle.opacity <= 0) continue;

      const gradient = ctx.createRadialGradient(
        particle.x,
        particle.y,
        0,
        particle.x,
        particle.y,
        particle.size
      );

      gradient.addColorStop(
        0,
        `rgba(180, 220, 255, ${particle.opacity * 0.4})`
      );
      gradient.addColorStop(
        0.5,
        `rgba(180, 220, 255, ${particle.opacity * 0.2})`
      );
      gradient.addColorStop(1, "rgba(180, 220, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ===========================================================================
  // BODY
  // ===========================================================================

  private drawBody(
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
      (p, i) => ({
        x: p.x * len,
        y: p.y * height * shape.dorsalMod + this.getFlexOffset(p.x, flexAmount),
      })
    );

    const ventralPoints = RENDER_CONFIG.bodyShape.ventralControlPoints.map(
      (p) => ({
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
    gradient.addColorStop(0.4, this.blendColors(colors.bodyTop, colors.bodyBottom, 0.3));
    gradient.addColorStop(1, colors.bodyBottom);

    ctx.fillStyle = gradient;
    ctx.fill();

    // Subtle outline
    ctx.strokeStyle = this.adjustAlpha(colors.bodyTop, 0.3);
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  private getFlexOffset(xFraction: number, flexAmount: number): number {
    // S-curve: positive at front, negative at back
    return Math.sin(xFraction * Math.PI * 2) * flexAmount;
  }

  // ===========================================================================
  // SCALE PATTERN
  // ===========================================================================

  private drawScalePattern(
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

        ctx.fillStyle = this.adjustAlpha(
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

  private drawLateralLine(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = RENDER_CONFIG.lateralLine;
    const y = height * config.yOffset;

    ctx.save();
    ctx.strokeStyle = this.adjustAlpha(fish.colors.accent, 0.25);
    ctx.lineWidth = 1;
    ctx.setLineDash([len * config.dashLength, len * config.gapLength]);

    ctx.beginPath();
    ctx.moveTo(-len * 0.35, y);
    ctx.lineTo(len * 0.35, y);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.restore();
  }

  // ===========================================================================
  // FINS
  // ===========================================================================

  private drawFins(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const fins = RENDER_CONFIG.fins;
    const colors = fish.colors;

    // Draw fins back to front
    // Tail fin first (behind body)
    this.drawTailFin(ctx, fish, len, height, fins.tail);

    // Pelvic and anal fins
    this.drawFin(
      ctx,
      fish.pelvicFin,
      fins.pelvic.x * len,
      fins.pelvic.y * height,
      len,
      height,
      colors,
      "down"
    );
    this.drawFin(
      ctx,
      fish.analFin,
      fins.anal.x * len,
      fins.anal.y * height,
      len,
      height,
      colors,
      "down"
    );

    // Pectoral fins (side fins)
    this.drawFin(
      ctx,
      fish.pectoralFinTop,
      fins.pectoralTop.x * len,
      fins.pectoralTop.y * height,
      len,
      height,
      colors,
      "up-back"
    );
    this.drawFin(
      ctx,
      fish.pectoralFinBottom,
      fins.pectoralBottom.x * len,
      fins.pectoralBottom.y * height,
      len,
      height,
      colors,
      "down-back"
    );

    // Dorsal fin (top)
    this.drawFin(
      ctx,
      fish.dorsalFin,
      fins.dorsal.x * len,
      fins.dorsal.y * height,
      len,
      height,
      colors,
      "up"
    );
  }

  private drawFin(
    ctx: CanvasRenderingContext2D,
    fin: FinState,
    attachX: number,
    attachY: number,
    len: number,
    height: number,
    colors: FishColorPalette,
    direction: "up" | "down" | "up-back" | "down-back"
  ): void {
    const finLen = fin.length * len;
    const finWidth = fin.width * height;

    ctx.save();
    ctx.translate(attachX, attachY);
    ctx.rotate(fin.angle);

    // Direction determines base angle
    let baseAngle = 0;
    switch (direction) {
      case "up":
        baseAngle = -Math.PI / 2;
        break;
      case "down":
        baseAngle = Math.PI / 2;
        break;
      case "up-back":
        baseAngle = -Math.PI / 3;
        break;
      case "down-back":
        baseAngle = Math.PI / 3;
        break;
    }

    ctx.rotate(baseAngle);

    // Draw fin as curved triangle
    ctx.beginPath();
    ctx.moveTo(0, 0); // Attachment point

    // Curved leading edge
    ctx.quadraticCurveTo(finLen * 0.3, -finWidth * 0.3, finLen, 0);

    // Curved trailing edge
    ctx.quadraticCurveTo(finLen * 0.6, finWidth * 0.4, 0, finWidth * 0.1);

    ctx.closePath();

    // Gradient fill
    const gradient = ctx.createLinearGradient(0, 0, finLen, 0);
    gradient.addColorStop(0, colors.finTint);
    gradient.addColorStop(1, this.adjustAlpha(colors.finTint, 0.2));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Fin rays (lines)
    ctx.strokeStyle = this.adjustAlpha(colors.accent, 0.2);
    ctx.lineWidth = 0.5;
    for (let i = 1; i < fin.segments; i++) {
      const t = i / fin.segments;
      ctx.beginPath();
      ctx.moveTo(0, finWidth * 0.05 * t);
      ctx.lineTo(finLen * (1 - t * 0.3), 0);
      ctx.stroke();
    }

    ctx.restore();
  }

  private drawTailFin(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number,
    attachPoint: { x: number; y: number }
  ): void {
    const tail = fish.tailFin;
    const tailLen = tail.length * len;
    const tailWidth = tail.width * height;
    const colors = fish.colors;

    ctx.save();
    ctx.translate(attachPoint.x * len, attachPoint.y * height);
    ctx.rotate(tail.angle);

    // Fork parameters
    const forkDepth = tail.forkDepth * tailLen;
    const forkSpread = tail.forkAngle;

    // Draw forked tail
    ctx.beginPath();

    // Top fork
    ctx.moveTo(0, -tailWidth * 0.1);
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      -tailWidth * 0.2 - forkSpread * tailWidth,
      tailLen,
      -tailWidth * forkSpread
    );

    // Fork indent
    ctx.quadraticCurveTo(
      tailLen - forkDepth,
      0,
      tailLen,
      tailWidth * forkSpread
    );

    // Bottom fork
    ctx.quadraticCurveTo(
      tailLen * 0.4,
      tailWidth * 0.2 + forkSpread * tailWidth,
      0,
      tailWidth * 0.1
    );

    ctx.closePath();

    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, tailLen, 0);
    gradient.addColorStop(0, colors.finTint);
    gradient.addColorStop(0.7, this.adjustAlpha(colors.finTint, 0.5));
    gradient.addColorStop(1, this.adjustAlpha(colors.accent, 0.3));

    ctx.fillStyle = gradient;
    ctx.fill();

    // Tail rays
    ctx.strokeStyle = this.adjustAlpha(colors.accent, 0.15);
    ctx.lineWidth = 0.5;
    for (let i = 0; i < tail.segments; i++) {
      const t = i / tail.segments - 0.5;
      const spread = t * forkSpread * tailWidth * 1.5;
      ctx.beginPath();
      ctx.moveTo(0, t * tailWidth * 0.2);
      ctx.quadraticCurveTo(tailLen * 0.5, spread * 0.5, tailLen * 0.9, spread);
      ctx.stroke();
    }

    ctx.restore();
  }

  // ===========================================================================
  // EYE
  // ===========================================================================

  private drawEye(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = RENDER_CONFIG.eye;
    const eyeX = config.xOffset * len;
    const eyeY = config.yOffset * height;
    const eyeRadius = fish.eyeSize * height;

    // Eye socket (slightly darker)
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = this.adjustAlpha(fish.colors.bodyTop, 0.8);
    ctx.fill();

    // Eyeball (white/light)
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, eyeRadius, 0, Math.PI * 2);
    const eyeGradient = ctx.createRadialGradient(
      eyeX - eyeRadius * 0.2,
      eyeY - eyeRadius * 0.2,
      0,
      eyeX,
      eyeY,
      eyeRadius
    );
    eyeGradient.addColorStop(0, "#ffffff");
    eyeGradient.addColorStop(0.7, "#e8e8e8");
    eyeGradient.addColorStop(1, "#cccccc");
    ctx.fillStyle = eyeGradient;
    ctx.fill();

    // Iris
    const irisRadius = eyeRadius * 0.65;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, irisRadius, 0, Math.PI * 2);
    const irisGradient = ctx.createRadialGradient(
      eyeX,
      eyeY,
      0,
      eyeX,
      eyeY,
      irisRadius
    );
    irisGradient.addColorStop(0, fish.colors.eye);
    irisGradient.addColorStop(0.8, this.adjustBrightness(fish.colors.eye, -20));
    irisGradient.addColorStop(1, this.adjustBrightness(fish.colors.eye, -40));
    ctx.fillStyle = irisGradient;
    ctx.fill();

    // Pupil
    const pupilRadius = eyeRadius * config.pupilSize;
    ctx.beginPath();
    ctx.arc(eyeX, eyeY, pupilRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#000000";
    ctx.fill();

    // Highlight
    const highlightX = eyeX + config.highlightOffset.x * eyeRadius;
    const highlightY = eyeY + config.highlightOffset.y * eyeRadius;
    const highlightRadius = eyeRadius * config.highlightSize;

    ctx.beginPath();
    ctx.arc(highlightX, highlightY, highlightRadius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
    ctx.fill();

    // Secondary smaller highlight
    ctx.beginPath();
    ctx.arc(
      highlightX + eyeRadius * 0.3,
      highlightY + eyeRadius * 0.35,
      highlightRadius * 0.4,
      0,
      Math.PI * 2
    );
    ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
    ctx.fill();
  }

  // ===========================================================================
  // GILL
  // ===========================================================================

  private drawGill(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    const config = RENDER_CONFIG.gill;
    const gillX = config.xOffset * len;
    const gillY = config.yOffset * height;
    const gillLen = config.length * height;

    // Animated gill opening
    const openAmount =
      config.openAmount + Math.sin(fish.gillPhase) * config.openAmount * 0.5;

    ctx.save();
    ctx.translate(gillX, gillY);

    // Draw gill slit as curved line
    ctx.beginPath();
    ctx.moveTo(0, -gillLen * 0.5);
    ctx.quadraticCurveTo(
      openAmount * height * 0.1,
      0,
      0,
      gillLen * 0.5
    );

    ctx.strokeStyle = this.adjustAlpha(fish.colors.bodyTop, 0.4);
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Inner gill (red when open)
    if (openAmount > 0.2) {
      ctx.beginPath();
      ctx.moveTo(openAmount * height * 0.02, -gillLen * 0.4);
      ctx.quadraticCurveTo(
        openAmount * height * 0.08,
        0,
        openAmount * height * 0.02,
        gillLen * 0.4
      );
      ctx.strokeStyle = `rgba(180, 80, 80, ${openAmount * 0.3})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    ctx.restore();
  }

  // ===========================================================================
  // BIOLUMINESCENCE
  // ===========================================================================

  private drawBioluminescenceGlow(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    if (!fish.hasBioluminescence || fish.glowIntensity <= 0) return;

    // Ambient glow around body
    const glowRadius = Math.max(len, height) * 0.8;

    ctx.save();

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    const glowColor = fish.colors.accent;
    const rgb = this.hexToRgb(glowColor);

    gradient.addColorStop(
      0,
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.3})`
    );
    gradient.addColorStop(
      0.5,
      `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${fish.glowIntensity * 0.1})`
    );
    gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  private drawBioluminescenceSpots(
    ctx: CanvasRenderingContext2D,
    fish: FishMarineLife,
    len: number,
    height: number
  ): void {
    if (!fish.hasBioluminescence || fish.glowIntensity <= 0) return;

    const config = RENDER_CONFIG.glow;

    ctx.save();

    // Draw glowing spots along body
    for (let i = 0; i < config.spotCount; i++) {
      const t = i / (config.spotCount - 1);
      const x = -len * 0.3 + t * len * 0.6;
      const y = Math.sin(t * Math.PI) * height * 0.15;

      // Pulsing intensity per spot
      const spotPhase = fish.glowPhase + i * 0.5;
      const spotIntensity =
        fish.glowIntensity * (0.5 + Math.sin(spotPhase) * 0.5);

      if (spotIntensity < 0.1) continue;

      const spotSize =
        height * (config.spotSize[0] + Math.random() * (config.spotSize[1] - config.spotSize[0]));
      const color = config.colors[i % config.colors.length]!;
      const rgb = this.hexToRgb(color);

      const gradient = ctx.createRadialGradient(x, y, 0, x, y, spotSize);
      gradient.addColorStop(
        0,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity})`
      );
      gradient.addColorStop(
        0.5,
        `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${spotIntensity * 0.5})`
      );
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(x, y, spotSize, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // ===========================================================================
  // COLOR UTILITIES
  // ===========================================================================

  private adjustAlpha(color: string, alpha: number): string {
    // Handle rgba
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }

    // Handle hex
    const rgb = this.hexToRgb(color);
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
  }

  private adjustBrightness(color: string, amount: number): string {
    const rgb = this.hexToRgb(color);
    const r = Math.max(0, Math.min(255, rgb.r + amount));
    const g = Math.max(0, Math.min(255, rgb.g + amount));
    const b = Math.max(0, Math.min(255, rgb.b + amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  private blendColors(color1: string, color2: string, ratio: number): string {
    const rgb1 = this.hexToRgb(color1);
    const rgb2 = this.hexToRgb(color2);

    const r = Math.round(rgb1.r + (rgb2.r - rgb1.r) * ratio);
    const g = Math.round(rgb1.g + (rgb2.g - rgb1.g) * ratio);
    const b = Math.round(rgb1.b + (rgb2.b - rgb1.b) * ratio);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Handle rgba format
    if (hex.startsWith("rgba")) {
      const match = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          r: parseInt(match[1]!, 10),
          g: parseInt(match[2]!, 10),
          b: parseInt(match[3]!, 10),
        };
      }
    }

    // Handle rgb format
    if (hex.startsWith("rgb")) {
      const match = hex.match(/rgb\((\d+),\s*(\d+),\s*(\d+)/);
      if (match) {
        return {
          r: parseInt(match[1]!, 10),
          g: parseInt(match[2]!, 10),
          b: parseInt(match[3]!, 10),
        };
      }
    }

    // Handle hex format
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1]!, 16),
          g: parseInt(result[2]!, 16),
          b: parseInt(result[3]!, 16),
        }
      : { r: 100, g: 150, b: 200 };
  }
}
