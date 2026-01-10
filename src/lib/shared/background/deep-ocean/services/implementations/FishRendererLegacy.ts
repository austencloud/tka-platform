import type {
  FishMarineLife,
  FishSpecies,
  FinState,
  TailState,
  FishColorPalette,
} from "../../domain/models/DeepOceanModels";
import type { IFishRenderer } from "../contracts/IFishRenderer";

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

/**
 * Legacy Fish Renderer - Kept for before/after comparison
 * Uses static bezier curves + sine wave body flex
 */
export class FishRendererLegacy implements IFishRenderer {
  drawFish(ctx: CanvasRenderingContext2D, fish: FishMarineLife[]): void {
    // Sort by depth layer for proper z-ordering (far first, near last)
    const sorted = [...fish].sort((a, b) => {
      const order = { far: 0, mid: 1, near: 2 };
      return order[a.depthLayer] - order[b.depthLayer];
    });

    for (const f of sorted) {
      this.drawSingleFish(ctx, f);
    }
  }

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
