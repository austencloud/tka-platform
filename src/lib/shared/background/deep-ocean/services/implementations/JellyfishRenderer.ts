import type {
  JellyfishMarineLife,
  OralArm,
  Tentacle,
} from "../../domain/models/DeepOceanModels";
import type { IJellyfishRenderer } from "../contracts/IJellyfishRenderer";

/**
 * A+ Jellyfish Renderer
 *
 * Renders anatomically-accurate jellyfish with:
 * - Dome-shaped bell with asymmetric deformation
 * - Visible gonads (4-leaf clover pattern)
 * - Mesoglea texture/veining
 * - Bell rim highlight (light catching edge)
 * - Margin frills with scalloped edge
 * - Oral arms (thick inner tentacles)
 * - Multi-segment trailing tentacles with fluid motion
 * - Bioluminescent traveling glow effects
 * - Particle trail from propulsion
 * - Species-specific characteristics
 */
export class JellyfishRenderer implements IJellyfishRenderer {
  drawJellyfish(
    ctx: CanvasRenderingContext2D,
    jellyfish: JellyfishMarineLife[]
  ): void {
    // Sort by depth for proper layering (far/large depth values drawn first)
    const sorted = [...jellyfish].sort((a, b) => b.depth - a.depth);

    for (const jelly of sorted) {
      this.drawSingleJellyfish(ctx, jelly);
    }
  }

  private drawSingleJellyfish(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife
  ): void {
    ctx.save();

    // Apply depth-based opacity (far = more transparent for depth-of-field effect)
    // depth 0 = close = full opacity, depth 1 = far = reduced opacity
    const depthOpacityScale = 1 - jelly.depth * 0.4; // 0.6 to 1.0 range
    ctx.globalAlpha = jelly.opacity * depthOpacityScale;

    ctx.translate(jelly.x, jelly.y);

    // Calculate pulse-affected dimensions with asymmetric deformation
    const pulseAmount = this.getPulseAmount(jelly.pulsePhase);
    const bellWidth = jelly.size * (1 - pulseAmount * 0.35);
    const bellHeight = jelly.size * jelly.bellAspect * (1 + pulseAmount * 0.2);

    // Draw layers back to front
    this.drawParticleTrail(ctx, jelly);
    this.drawTrailingTentacles(ctx, jelly, bellWidth, bellHeight);
    this.drawOralArms(ctx, jelly, bellWidth, bellHeight);
    this.drawBellGlow(ctx, jelly, bellWidth, bellHeight);
    this.drawBellBody(ctx, jelly, bellWidth, bellHeight, pulseAmount);
    this.drawMesogleaTexture(ctx, jelly, bellWidth, bellHeight);
    this.drawGonads(ctx, jelly, bellWidth, bellHeight);
    this.drawRadialChannels(ctx, jelly, bellWidth, bellHeight);
    this.drawMarginFrills(ctx, jelly, bellWidth, bellHeight, pulseAmount);
    this.drawBellRimHighlight(ctx, jelly, bellWidth, bellHeight, pulseAmount);
    this.drawBioluminescentHighlights(ctx, jelly, bellWidth, bellHeight);

    ctx.restore();
  }

  /**
   * Convert pulse phase (0-1) to contraction amount (0-1)
   */
  private getPulseAmount(phase: number): number {
    const normalizedPhase = phase % 1;
    if (normalizedPhase < 0.3) {
      return Math.sin((normalizedPhase / 0.3) * Math.PI * 0.5);
    } else {
      const relaxPhase = (normalizedPhase - 0.3) / 0.7;
      return Math.cos(relaxPhase * Math.PI * 0.5);
    }
  }

  /**
   * Draw particle trail from propulsion
   */
  private drawParticleTrail(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife
  ): void {
    if (!jelly.trailPositions || jelly.trailPositions.length === 0) return;

    ctx.save();
    const accentColor = this.parseColor(jelly.accentColor);

    for (const pos of jelly.trailPositions) {
      if (!pos) continue;
      const alpha = (1 - pos.age) * 0.4;
      const size = (1 - pos.age) * 3 + 1;

      // Position relative to jellyfish
      const relX = pos.x - jelly.x;
      const relY = pos.y - jelly.y;

      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.rgba(accentColor, 0.8);
      ctx.beginPath();
      ctx.arc(relX, relY, size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw the main bell body with dome shape and asymmetric deformation
   */
  private drawBellBody(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number,
    pulseAmount: number
  ): void {
    ctx.save();

    ctx.beginPath();
    this.traceBellPath(ctx, jelly, bellWidth, bellHeight, pulseAmount);

    // Multi-layer gradient for translucent depth
    const gradient = ctx.createRadialGradient(
      0,
      -bellHeight * 0.2,
      0,
      0,
      bellHeight * 0.3,
      bellWidth * 0.8
    );

    const baseColor = this.parseColor(jelly.color);
    const accentColor = this.parseColor(jelly.accentColor);

    gradient.addColorStop(0, this.rgba(accentColor, 0.85));
    gradient.addColorStop(0.25, this.rgba(baseColor, 0.65));
    gradient.addColorStop(0.5, this.rgba(baseColor, 0.45));
    gradient.addColorStop(0.75, this.rgba(baseColor, 0.3));
    gradient.addColorStop(1, this.rgba(this.darkenRgb(baseColor, 0.3), 0.2));

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Trace the dome-shaped bell path with asymmetric deformation
   */
  private traceBellPath(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number,
    pulseAmount: number
  ): void {
    const halfWidth = bellWidth / 2;
    const topY = -bellHeight * 0.7;
    const bottomY = bellHeight * 0.3;
    const seeds = jelly.bellDeformSeeds || [];

    // Apply asymmetric deformation based on seeds
    const getDeform = (index: number) => {
      const seed = seeds[index % seeds.length] ?? 0.5;
      return (seed - 0.5) * pulseAmount * bellWidth * 0.08;
    };

    ctx.moveTo(-halfWidth + getDeform(0), bottomY);

    // Left side with deformation
    ctx.bezierCurveTo(
      -halfWidth * 1.1 + getDeform(1),
      bottomY - bellHeight * 0.3,
      -halfWidth * 0.9 + getDeform(2),
      topY + bellHeight * 0.2,
      getDeform(3),
      topY
    );

    // Right side with deformation
    ctx.bezierCurveTo(
      halfWidth * 0.9 + getDeform(4),
      topY + bellHeight * 0.2,
      halfWidth * 1.1 + getDeform(5),
      bottomY - bellHeight * 0.3,
      halfWidth + getDeform(6),
      bottomY
    );

    // Bottom edge
    const bottomCurve = pulseAmount * bellHeight * 0.15;
    ctx.quadraticCurveTo(
      getDeform(7),
      bottomY + bottomCurve,
      -halfWidth + getDeform(0),
      bottomY
    );

    ctx.closePath();
  }

  /**
   * Draw mesoglea texture (internal veining)
   */
  private drawMesogleaTexture(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    const seeds = jelly.mesogleaSeeds || [];
    if (seeds.length === 0) return;

    ctx.save();
    ctx.globalAlpha = 0.12;

    const detailColor = this.parseColor(jelly.detailColor || jelly.color);
    ctx.strokeStyle = this.rgba(this.lightenRgb(detailColor, 0.3), 0.5);
    ctx.lineWidth = 0.5;

    // Draw subtle veining patterns radiating from center
    const centerY = -bellHeight * 0.2;

    for (let i = 0; i < seeds.length; i++) {
      const seed = seeds[i] ?? 0.5;
      const angle = (i / seeds.length) * Math.PI * 2;
      const length = bellWidth * 0.3 * (0.5 + seed * 0.5);
      const startDist = bellWidth * 0.08;

      const startX = Math.cos(angle) * startDist;
      const startY = centerY + Math.sin(angle) * startDist * 0.6;
      const endX = Math.cos(angle) * length;
      const endY = centerY + Math.sin(angle) * length * 0.6;

      // Curved vein with slight wobble
      const wobble = (seed - 0.5) * bellWidth * 0.1;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        (startX + endX) / 2 + wobble,
        (startY + endY) / 2,
        endX,
        endY
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw gonads (the distinctive 4-leaf clover pattern)
   */
  private drawGonads(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    if (!jelly.gonads) return;

    ctx.save();

    const { lobeCount, size, rotation, color } = jelly.gonads;
    const gonadColor = this.parseColor(color);
    const centerY = -bellHeight * 0.15;
    const gonadRadius = bellWidth * size;

    ctx.translate(0, centerY);
    ctx.rotate(rotation);

    // Draw each lobe
    for (let i = 0; i < lobeCount; i++) {
      const angle = (i / lobeCount) * Math.PI * 2;
      const lobeX = Math.cos(angle) * gonadRadius * 0.5;
      const lobeY = Math.sin(angle) * gonadRadius * 0.5;

      // Gradient for each lobe
      const gradient = ctx.createRadialGradient(
        lobeX,
        lobeY,
        0,
        lobeX,
        lobeY,
        gonadRadius * 0.4
      );
      gradient.addColorStop(0, this.rgba(this.lightenRgb(gonadColor, 0.2), 0.6));
      gradient.addColorStop(0.6, this.rgba(gonadColor, 0.4));
      gradient.addColorStop(1, this.rgba(gonadColor, 0.1));

      ctx.fillStyle = gradient;
      ctx.beginPath();

      // Horseshoe/kidney shape for each lobe
      ctx.ellipse(
        lobeX,
        lobeY,
        gonadRadius * 0.35,
        gonadRadius * 0.25,
        angle,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Central connection
    const centerGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, gonadRadius * 0.2);
    centerGradient.addColorStop(0, this.rgba(gonadColor, 0.4));
    centerGradient.addColorStop(1, this.rgba(gonadColor, 0));
    ctx.fillStyle = centerGradient;
    ctx.beginPath();
    ctx.arc(0, 0, gonadRadius * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw bell rim highlight (light catching the thin edge)
   */
  private drawBellRimHighlight(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number,
    pulseAmount: number
  ): void {
    ctx.save();

    const accentColor = this.parseColor(jelly.accentColor);
    const bottomY = bellHeight * 0.3;
    const halfWidth = bellWidth / 2;

    // Bright highlight along the bell rim
    ctx.strokeStyle = this.rgba(this.lightenRgb(accentColor, 0.6), 0.5);
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";

    // Draw highlight arc along bottom edge
    ctx.beginPath();
    ctx.moveTo(-halfWidth * 0.9, bottomY - 2);
    ctx.quadraticCurveTo(0, bottomY + pulseAmount * bellHeight * 0.1, halfWidth * 0.9, bottomY - 2);
    ctx.stroke();

    // Secondary inner highlight
    ctx.strokeStyle = this.rgba(this.lightenRgb(accentColor, 0.8), 0.3);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-halfWidth * 0.7, bottomY - 5);
    ctx.quadraticCurveTo(0, bottomY + pulseAmount * bellHeight * 0.05, halfWidth * 0.7, bottomY - 5);
    ctx.stroke();

    ctx.restore();
  }

  /**
   * Draw the outer glow effect
   */
  private drawBellGlow(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    ctx.save();

    const glowRadius = Math.max(bellWidth, bellHeight) * 1.4;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);

    const accentColor = this.parseColor(jelly.accentColor);
    const glowIntensity = jelly.glowIntensity * 0.35;

    gradient.addColorStop(0, this.rgba(accentColor, glowIntensity * 0.7));
    gradient.addColorStop(0.25, this.rgba(accentColor, glowIntensity * 0.4));
    gradient.addColorStop(0.5, this.rgba(accentColor, glowIntensity * 0.15));
    gradient.addColorStop(1, this.rgba(accentColor, 0));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw visible radial channels inside the bell
   */
  private drawRadialChannels(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    if (jelly.radialChannels < 1) return;

    ctx.save();
    ctx.globalAlpha = 0.2;

    const accentColor = this.parseColor(jelly.accentColor);
    ctx.strokeStyle = this.rgba(this.lightenRgb(accentColor, 0.4), 0.5);
    ctx.lineWidth = 0.8;

    const centerY = -bellHeight * 0.1;
    const channelLength = bellHeight * 0.45;

    for (let i = 0; i < jelly.radialChannels; i++) {
      const angle =
        (i / jelly.radialChannels) * Math.PI -
        Math.PI / 2 +
        Math.PI / jelly.radialChannels / 2;
      const startX = Math.cos(angle) * bellWidth * 0.08;
      const startY = centerY + Math.sin(angle) * bellHeight * 0.08;
      const endX = Math.cos(angle) * bellWidth * 0.38;
      const endY = centerY + Math.sin(angle) * channelLength * 0.55;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.quadraticCurveTo(
        (startX + endX) / 2 + Math.cos(angle) * 4,
        (startY + endY) / 2,
        endX,
        endY
      );
      ctx.stroke();
    }

    ctx.restore();
  }

  /**
   * Draw margin frills along the bell edge
   */
  private drawMarginFrills(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number,
    pulseAmount: number
  ): void {
    if (jelly.frillCount < 1) return;

    ctx.save();

    const accentColor = this.parseColor(jelly.accentColor);
    ctx.strokeStyle = this.rgba(this.lightenRgb(accentColor, 0.25), 0.4);
    ctx.lineWidth = 0.6;

    const bottomY = bellHeight * 0.3;
    const frillHeight = bellHeight * 0.12 * (1 + pulseAmount * 0.4);
    const halfWidth = bellWidth / 2;

    ctx.beginPath();

    for (let i = 0; i <= jelly.frillCount; i++) {
      const t = i / jelly.frillCount;
      const x = -halfWidth + t * bellWidth;

      if (i === 0) {
        ctx.moveTo(x, bottomY);
      }

      if (i < jelly.frillCount) {
        const nextT = (i + 1) / jelly.frillCount;
        const nextX = -halfWidth + nextT * bellWidth;
        const midX = (x + nextX) / 2;
        const midWave =
          Math.sin(jelly.frillPhase + ((t + nextT) / 2) * Math.PI * 4) *
          frillHeight *
          0.6;

        ctx.quadraticCurveTo(midX, bottomY + frillHeight + midWave, nextX, bottomY);
      }
    }

    ctx.stroke();
    ctx.restore();
  }

  /**
   * Draw oral arms (thick inner tentacles)
   */
  private drawOralArms(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    if (!jelly.oralArms || jelly.oralArms.length === 0) return;

    ctx.save();
    const baseColor = this.parseColor(jelly.color);
    const originY = bellHeight * 0.35;

    for (const arm of jelly.oralArms) {
      this.drawSingleOralArm(ctx, arm, bellWidth, bellHeight, originY, baseColor);
    }

    ctx.restore();
  }

  private drawSingleOralArm(
    ctx: CanvasRenderingContext2D,
    arm: OralArm,
    bellWidth: number,
    bellHeight: number,
    originY: number,
    baseColor: { r: number; g: number; b: number }
  ): void {
    const length = arm.length * bellHeight;
    const thickness = arm.thickness * bellWidth;
    const startX = Math.cos(arm.angle) * bellWidth * 0.15;

    const gradient = ctx.createLinearGradient(0, originY, 0, originY + length);
    gradient.addColorStop(0, this.rgba(baseColor, 0.5));
    gradient.addColorStop(0.5, this.rgba(baseColor, 0.35));
    gradient.addColorStop(1, this.rgba(baseColor, 0.1));

    ctx.fillStyle = gradient;
    ctx.beginPath();

    const segments = 8;
    const points: { x: number; y: number }[] = [];

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const y = originY + t * length;
      const wave = Math.sin(arm.phase + t * Math.PI * 3) * thickness * 0.35;
      const taper = 1 - t * 0.6;
      points.push({ x: startX + wave + thickness * taper * 0.5, y });
    }

    ctx.moveTo(startX, originY);
    for (const p of points) {
      if (p) ctx.lineTo(p.x, p.y);
    }

    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      if (p) ctx.lineTo(startX * 2 - p.x, p.y);
    }

    ctx.closePath();
    ctx.fill();
  }

  /**
   * Draw trailing tentacles with fluid physics
   */
  private drawTrailingTentacles(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    if (!jelly.tentacles || jelly.tentacles.length === 0) return;

    ctx.save();

    const originY = bellHeight * 0.3;
    const accentColor = this.parseColor(jelly.accentColor);
    const baseColor = this.parseColor(jelly.color);

    for (const tentacle of jelly.tentacles) {
      this.drawSingleTentacle(
        ctx,
        tentacle,
        bellWidth,
        originY,
        accentColor,
        baseColor,
        jelly.glowPhase
      );
    }

    ctx.restore();
  }

  private drawSingleTentacle(
    ctx: CanvasRenderingContext2D,
    tentacle: Tentacle,
    bellWidth: number,
    originY: number,
    accentColor: { r: number; g: number; b: number },
    baseColor: { r: number; g: number; b: number },
    glowPhase: number
  ): void {
    if (tentacle.segments.length === 0) return;

    const startX = tentacle.originX * bellWidth * 0.4;
    let currentX = startX;
    let currentY = originY;
    let currentAngle = Math.PI / 2;

    const pathPoints: { x: number; y: number; thickness: number }[] = [
      { x: currentX, y: currentY, thickness: tentacle.thickness },
    ];

    for (let i = 0; i < tentacle.segments.length; i++) {
      const segment = tentacle.segments[i];
      if (!segment) continue;
      currentAngle += segment.angle;

      const dx = Math.cos(currentAngle) * segment.length;
      const dy = Math.sin(currentAngle) * segment.length;
      currentX += dx;
      currentY += dy;

      const taper = 1 - (i / tentacle.segments.length) * 0.8;
      pathPoints.push({
        x: currentX,
        y: currentY,
        thickness: tentacle.thickness * taper,
      });
    }

    ctx.globalAlpha = tentacle.opacity;

    const firstPoint = pathPoints[0];
    const lastPoint = pathPoints[pathPoints.length - 1];
    if (!firstPoint || !lastPoint) return;

    // Outer glow
    ctx.save();
    ctx.shadowColor = this.rgba(accentColor, 0.5);
    ctx.shadowBlur = 6;
    ctx.strokeStyle = this.rgba(accentColor, 0.25);
    ctx.lineWidth = tentacle.thickness * 1.8;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);
    for (let i = 1; i < pathPoints.length; i++) {
      const pt = pathPoints[i];
      if (pt) ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();
    ctx.restore();

    // Main tentacle
    const gradient = ctx.createLinearGradient(
      startX,
      originY,
      lastPoint.x,
      lastPoint.y
    );
    gradient.addColorStop(0, this.rgba(baseColor, 0.6));
    gradient.addColorStop(0.4, this.rgba(accentColor, 0.4));
    gradient.addColorStop(1, this.rgba(accentColor, 0.15));

    ctx.strokeStyle = gradient;
    ctx.lineWidth = tentacle.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(firstPoint.x, firstPoint.y);

    for (let i = 1; i < pathPoints.length - 1; i++) {
      const curr = pathPoints[i];
      const next = pathPoints[i + 1];
      if (!curr || !next) continue;
      const xc = (curr.x + next.x) / 2;
      const yc = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(curr.x, curr.y, xc, yc);
    }
    ctx.lineTo(lastPoint.x, lastPoint.y);
    ctx.stroke();

    this.drawTentacleBioluminescence(ctx, pathPoints, accentColor, glowPhase);
  }

  /**
   * Draw traveling bioluminescent spots on tentacles
   */
  private drawTentacleBioluminescence(
    ctx: CanvasRenderingContext2D,
    pathPoints: { x: number; y: number; thickness: number }[],
    accentColor: { r: number; g: number; b: number },
    glowPhase: number
  ): void {
    const spotCount = 2;

    for (let s = 0; s < spotCount; s++) {
      const spotPhase = (glowPhase + s / spotCount) % 1;
      const pointIndex = Math.floor(spotPhase * (pathPoints.length - 1));
      const point = pathPoints[pointIndex];

      if (point) {
        const intensity = Math.sin(spotPhase * Math.PI) * 0.7;

        if (intensity > 0.1) {
          ctx.save();
          ctx.globalAlpha = intensity;

          const gradient = ctx.createRadialGradient(
            point.x,
            point.y,
            0,
            point.x,
            point.y,
            point.thickness * 2.5
          );
          gradient.addColorStop(0, this.rgba(this.lightenRgb(accentColor, 0.5), 0.9));
          gradient.addColorStop(0.3, this.rgba(accentColor, 0.5));
          gradient.addColorStop(1, this.rgba(accentColor, 0));

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(point.x, point.y, point.thickness * 2.5, 0, Math.PI * 2);
          ctx.fill();

          ctx.restore();
        }
      }
    }
  }

  /**
   * Draw bioluminescent highlights on the bell
   */
  private drawBioluminescentHighlights(
    ctx: CanvasRenderingContext2D,
    jelly: JellyfishMarineLife,
    bellWidth: number,
    bellHeight: number
  ): void {
    ctx.save();

    const accentColor = this.parseColor(jelly.accentColor);
    const intensity = (Math.sin(jelly.glowPhase * Math.PI * 2) + 1) / 2;

    // Apex glow
    const topGlow = ctx.createRadialGradient(
      0,
      -bellHeight * 0.5,
      0,
      0,
      -bellHeight * 0.5,
      bellWidth * 0.25
    );
    topGlow.addColorStop(0, this.rgba(this.lightenRgb(accentColor, 0.6), intensity * 0.6));
    topGlow.addColorStop(0.5, this.rgba(accentColor, intensity * 0.25));
    topGlow.addColorStop(1, this.rgba(accentColor, 0));

    ctx.fillStyle = topGlow;
    ctx.beginPath();
    ctx.arc(0, -bellHeight * 0.5, bellWidth * 0.25, 0, Math.PI * 2);
    ctx.fill();

    // Center glow
    const centerGlow = ctx.createRadialGradient(
      0,
      -bellHeight * 0.1,
      0,
      0,
      -bellHeight * 0.1,
      bellWidth * 0.2
    );
    centerGlow.addColorStop(0, this.rgba(this.lightenRgb(accentColor, 0.4), intensity * 0.4));
    centerGlow.addColorStop(1, this.rgba(accentColor, 0));

    ctx.fillStyle = centerGlow;
    ctx.beginPath();
    ctx.arc(0, -bellHeight * 0.1, bellWidth * 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  // ============================================
  // Color Utility Methods
  // ============================================

  private parseColor(color: string): { r: number; g: number; b: number } {
    const hex = color.replace("#", "");
    return {
      r: parseInt(hex.substring(0, 2), 16),
      g: parseInt(hex.substring(2, 4), 16),
      b: parseInt(hex.substring(4, 6), 16),
    };
  }

  private rgba(
    color: { r: number; g: number; b: number },
    alpha: number
  ): string {
    return `rgba(${color.r}, ${color.g}, ${color.b}, ${alpha})`;
  }

  private lightenRgb(
    color: { r: number; g: number; b: number },
    amount: number
  ): { r: number; g: number; b: number } {
    return {
      r: Math.min(255, Math.round(color.r + (255 - color.r) * amount)),
      g: Math.min(255, Math.round(color.g + (255 - color.g) * amount)),
      b: Math.min(255, Math.round(color.b + (255 - color.b) * amount)),
    };
  }

  private darkenRgb(
    color: { r: number; g: number; b: number },
    amount: number
  ): { r: number; g: number; b: number } {
    return {
      r: Math.max(0, Math.round(color.r * (1 - amount))),
      g: Math.max(0, Math.round(color.g * (1 - amount))),
      b: Math.max(0, Math.round(color.b * (1 - amount))),
    };
  }
}
