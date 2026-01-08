import { injectable } from "inversify";
import type { Bubble } from "../../domain/models/DeepOceanModels";
import type { IBubbleRenderer } from "../contracts/IBubbleRenderer";

/**
 * A+ Bubble Renderer
 *
 * Renders physically-accurate bubbles with:
 * - Gradient shell (translucent soap-bubble effect)
 * - Iridescent surface shimmer (rainbow that shifts with phase)
 * - Inner refraction layer (distorted interior highlight)
 * - Dynamic rim highlight (moves with light direction)
 * - Wobble deformation (non-circular oscillation)
 * - Trail particles (micro-bubbles following)
 * - Size-based visual characteristics
 */
@injectable()
export class BubbleRenderer implements IBubbleRenderer {
  drawBubbles(ctx: CanvasRenderingContext2D, bubbles: Bubble[]): void {
    // Sort by Y position for proper depth ordering (far first)
    const sorted = [...bubbles].sort((a, b) => b.y - a.y);

    for (const bubble of sorted) {
      this.drawSingleBubble(ctx, bubble);
    }
  }

  private drawSingleBubble(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble
  ): void {
    ctx.save();
    ctx.globalAlpha = bubble.opacity;
    ctx.translate(bubble.x, bubble.y);

    // Calculate wobble deformation
    const wobbleX = 1 + Math.sin(bubble.wobblePhase) * bubble.wobbleAmplitude;
    const wobbleY = 1 + Math.cos(bubble.wobblePhase) * bubble.wobbleAmplitude;

    // Draw layers back to front
    this.drawTrailParticles(ctx, bubble);
    this.drawGlowHalo(ctx, bubble, wobbleX, wobbleY);
    this.drawShellGradient(ctx, bubble, wobbleX, wobbleY);
    this.drawInnerRefraction(ctx, bubble, wobbleX, wobbleY);
    this.drawIridescentShimmer(ctx, bubble, wobbleX, wobbleY);
    this.drawRimHighlight(ctx, bubble, wobbleX, wobbleY);

    ctx.restore();
  }

  /**
   * Draw trail particles (micro-bubbles following larger bubble)
   */
  private drawTrailParticles(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble
  ): void {
    if (bubble.trailParticles.length === 0) return;

    for (const particle of bubble.trailParticles) {
      const alpha = (1 - particle.age) * 0.5;
      const relX = particle.x - bubble.x;
      const relY = particle.y - bubble.y;

      ctx.save();
      ctx.globalAlpha = alpha * bubble.opacity;

      // Simple gradient for trail particles
      const gradient = ctx.createRadialGradient(
        relX,
        relY,
        0,
        relX,
        relY,
        particle.size
      );
      gradient.addColorStop(0, "rgba(200, 230, 255, 0.6)");
      gradient.addColorStop(0.6, "rgba(180, 215, 240, 0.3)");
      gradient.addColorStop(1, "rgba(160, 200, 230, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(relX, relY, particle.size, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  /**
   * Draw soft outer glow halo
   */
  private drawGlowHalo(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    wobbleX: number,
    wobbleY: number
  ): void {
    const glowRadius = bubble.radius * 1.5;

    ctx.save();
    ctx.globalAlpha = 0.15 * bubble.opacity;

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, glowRadius);
    gradient.addColorStop(0, "rgba(173, 216, 250, 0.4)");
    gradient.addColorStop(0.5, "rgba(150, 200, 240, 0.15)");
    gradient.addColorStop(1, "rgba(130, 180, 220, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, glowRadius * wobbleX, glowRadius * wobbleY, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw main shell gradient (soap bubble translucency)
   */
  private drawShellGradient(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    wobbleX: number,
    wobbleY: number
  ): void {
    const r = bubble.radius;

    // Multi-layer radial gradient for glass-like translucency
    const gradient = ctx.createRadialGradient(
      -r * 0.2, // Offset center for depth
      -r * 0.2,
      r * 0.1,
      0,
      0,
      r
    );

    // Translucent layers - thin at center, thicker at edges
    gradient.addColorStop(0, "rgba(255, 255, 255, 0.02)"); // Almost clear center
    gradient.addColorStop(0.4, "rgba(200, 230, 255, 0.08)");
    gradient.addColorStop(0.7, "rgba(173, 216, 250, 0.2)");
    gradient.addColorStop(0.85, "rgba(150, 200, 240, 0.35)");
    gradient.addColorStop(0.95, "rgba(130, 185, 230, 0.5)");
    gradient.addColorStop(1, "rgba(110, 170, 220, 0.3)"); // Faded edge

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.ellipse(0, 0, r * wobbleX, r * wobbleY, 0, 0, Math.PI * 2);
    ctx.fill();

    // Thin stroke for bubble edge definition
    ctx.strokeStyle = "rgba(180, 210, 240, 0.4)";
    ctx.lineWidth = 0.5;
    ctx.stroke();
  }

  /**
   * Draw inner refraction layer (distorted highlight showing depth)
   */
  private drawInnerRefraction(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    wobbleX: number,
    wobbleY: number
  ): void {
    const r = bubble.radius;

    // Inner refraction arc - slightly off-center, curved highlight
    ctx.save();
    ctx.globalAlpha = 0.25;

    // Position based on size category
    const offsetMultiplier = bubble.sizeCategory === "large" ? 0.25 : 0.3;
    const sizeMultiplier = bubble.sizeCategory === "large" ? 0.5 : 0.4;

    const innerGradient = ctx.createRadialGradient(
      r * offsetMultiplier,
      r * offsetMultiplier,
      0,
      r * offsetMultiplier,
      r * offsetMultiplier,
      r * sizeMultiplier
    );
    innerGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
    innerGradient.addColorStop(0.5, "rgba(220, 240, 255, 0.15)");
    innerGradient.addColorStop(1, "rgba(200, 230, 255, 0)");

    ctx.fillStyle = innerGradient;
    ctx.beginPath();
    ctx.ellipse(
      r * offsetMultiplier,
      r * offsetMultiplier,
      r * sizeMultiplier * wobbleX,
      r * sizeMultiplier * 0.7 * wobbleY,
      Math.PI * 0.25, // Rotated for natural look
      0,
      Math.PI * 2
    );
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw iridescent shimmer (rainbow effect that shifts)
   */
  private drawIridescentShimmer(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    wobbleX: number,
    wobbleY: number
  ): void {
    // Only render iridescence on medium and large bubbles
    if (bubble.sizeCategory === "small") return;

    const r = bubble.radius;
    const phase = bubble.iridescentPhase;

    ctx.save();
    ctx.globalAlpha = bubble.sizeCategory === "large" ? 0.2 : 0.12;

    // Create arc segment for iridescent band
    const arcAngle = phase * 2;
    const arcWidth = Math.PI * 0.4;

    // Iridescent colors shift based on phase
    const hue1 = (phase * 360) % 360;
    const hue2 = (hue1 + 60) % 360;
    const hue3 = (hue1 + 120) % 360;

    // Draw as a thin crescent arc
    const arcRadius = r * 0.85;
    const arcThickness = r * 0.15;

    ctx.beginPath();
    ctx.arc(0, 0, arcRadius * wobbleX, arcAngle, arcAngle + arcWidth);
    ctx.arc(
      0,
      0,
      (arcRadius - arcThickness) * wobbleX,
      arcAngle + arcWidth,
      arcAngle,
      true
    );
    ctx.closePath();

    // Gradient along the arc
    const gradient = ctx.createLinearGradient(
      Math.cos(arcAngle) * r,
      Math.sin(arcAngle) * r,
      Math.cos(arcAngle + arcWidth) * r,
      Math.sin(arcAngle + arcWidth) * r
    );
    gradient.addColorStop(0, `hsla(${hue1}, 70%, 70%, 0.5)`);
    gradient.addColorStop(0.5, `hsla(${hue2}, 80%, 75%, 0.6)`);
    gradient.addColorStop(1, `hsla(${hue3}, 70%, 70%, 0.5)`);

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw dynamic rim highlight (light catching the edge)
   */
  private drawRimHighlight(
    ctx: CanvasRenderingContext2D,
    bubble: Bubble,
    wobbleX: number,
    wobbleY: number
  ): void {
    const r = bubble.radius;
    const angle = bubble.rimHighlightAngle;

    ctx.save();

    // Primary highlight (bright spot)
    const highlightX = Math.cos(angle) * r * 0.6 * wobbleX;
    const highlightY = Math.sin(angle) * r * 0.6 * wobbleY;
    const highlightSize = r * (bubble.sizeCategory === "large" ? 0.35 : 0.3);

    const highlightGradient = ctx.createRadialGradient(
      highlightX,
      highlightY,
      0,
      highlightX,
      highlightY,
      highlightSize
    );
    highlightGradient.addColorStop(0, "rgba(255, 255, 255, 0.8)");
    highlightGradient.addColorStop(0.3, "rgba(255, 255, 255, 0.5)");
    highlightGradient.addColorStop(0.6, "rgba(230, 245, 255, 0.2)");
    highlightGradient.addColorStop(1, "rgba(200, 230, 255, 0)");

    ctx.fillStyle = highlightGradient;
    ctx.beginPath();
    ctx.ellipse(
      highlightX,
      highlightY,
      highlightSize,
      highlightSize * 0.6,
      angle + Math.PI * 0.25,
      0,
      Math.PI * 2
    );
    ctx.fill();

    // Secondary highlight (smaller, opposite side)
    const secondaryAngle = angle + Math.PI * 0.85;
    const secondaryX = Math.cos(secondaryAngle) * r * 0.75 * wobbleX;
    const secondaryY = Math.sin(secondaryAngle) * r * 0.75 * wobbleY;
    const secondarySize = r * 0.15;

    ctx.globalAlpha = 0.5;
    const secondaryGradient = ctx.createRadialGradient(
      secondaryX,
      secondaryY,
      0,
      secondaryX,
      secondaryY,
      secondarySize
    );
    secondaryGradient.addColorStop(0, "rgba(255, 255, 255, 0.6)");
    secondaryGradient.addColorStop(0.5, "rgba(240, 250, 255, 0.3)");
    secondaryGradient.addColorStop(1, "rgba(220, 240, 255, 0)");

    ctx.fillStyle = secondaryGradient;
    ctx.beginPath();
    ctx.arc(secondaryX, secondaryY, secondarySize, 0, Math.PI * 2);
    ctx.fill();

    // Rim edge highlight (thin bright line along edge)
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 0.8;
    ctx.lineCap = "round";

    const rimStartAngle = angle - Math.PI * 0.2;
    const rimEndAngle = angle + Math.PI * 0.2;

    ctx.beginPath();
    ctx.ellipse(
      0,
      0,
      r * 0.92 * wobbleX,
      r * 0.92 * wobbleY,
      0,
      rimStartAngle,
      rimEndAngle
    );
    ctx.stroke();

    ctx.restore();
  }
}
