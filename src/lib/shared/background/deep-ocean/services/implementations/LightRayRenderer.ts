import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { LightRay, CausticsState } from "../../domain/models/DeepOceanModels";
import type { ILightRayRenderer } from "../contracts/ILightRayRenderer";

/**
 * A+ Light Ray Renderer
 *
 * Renders ethereal underwater light with:
 * - Volumetric god rays with soft gaussian edges
 * - Depth color shifting (cyan → deep blue)
 * - Dappled, organic edges (not rectangles)
 * - Wave distortion (rays sway with surface)
 * - Visible dust particles in beams
 * - Caustic patterns on the ocean floor
 * - Intensity pulsing (clouds passing)
 */
export class LightRayRenderer implements ILightRayRenderer {
  drawLightRays(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    lightRays: LightRay[],
    quality: string
  ): void {
    if (quality === "minimal" || lightRays.length === 0) return;

    ctx.save();

    for (const ray of lightRays) {
      this.drawSingleRay(ctx, dimensions, ray, quality);
    }

    ctx.restore();
  }

  private drawSingleRay(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    ray: LightRay,
    quality: string
  ): void {
    ctx.save();
    ctx.translate(ray.x, 0);
    ctx.rotate((ray.angle * Math.PI) / 180);

    const rayHeight = dimensions.height * ray.depthFade;

    // Draw layers back to front
    this.drawVolumetricGlow(ctx, ray, rayHeight);
    this.drawDappledRayBody(ctx, ray, rayHeight);
    this.drawDustParticles(ctx, ray, rayHeight, quality);

    ctx.restore();
  }

  /**
   * Draw soft volumetric glow around ray
   */
  private drawVolumetricGlow(
    ctx: CanvasRenderingContext2D,
    ray: LightRay,
    rayHeight: number
  ): void {
    const glowWidth = ray.width * 2;

    ctx.save();
    ctx.globalAlpha = ray.opacity * ray.glowIntensity * 0.3;

    // Outer glow gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, rayHeight);

    // Color shift based on phase (subtle cyan to blue variation)
    const hueShift = Math.sin(ray.colorShiftPhase) * 10;
    const baseHue = 195 + hueShift; // Cyan-blue range

    gradient.addColorStop(0, `hsla(${baseHue}, 70%, 75%, 0.4)`);
    gradient.addColorStop(0.2, `hsla(${baseHue + 5}, 65%, 65%, 0.25)`);
    gradient.addColorStop(0.5, `hsla(${baseHue + 10}, 60%, 55%, 0.12)`);
    gradient.addColorStop(0.8, `hsla(${baseHue + 15}, 55%, 45%, 0.05)`);
    gradient.addColorStop(1, `hsla(${baseHue + 20}, 50%, 35%, 0)`);

    ctx.fillStyle = gradient;

    // Draw as tapered cone (wider at top, narrower at bottom)
    ctx.beginPath();
    ctx.moveTo(-glowWidth / 2, 0);
    ctx.lineTo(-glowWidth * 0.3, rayHeight);
    ctx.lineTo(glowWidth * 0.3, rayHeight);
    ctx.lineTo(glowWidth / 2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Draw main ray body with dappled, organic edges
   */
  private drawDappledRayBody(
    ctx: CanvasRenderingContext2D,
    ray: LightRay,
    rayHeight: number
  ): void {
    const halfWidth = ray.width / 2;

    ctx.save();
    ctx.globalAlpha = ray.opacity;

    // Create gradient with color shift
    const gradient = ctx.createLinearGradient(0, 0, 0, rayHeight);
    const hueShift = Math.sin(ray.colorShiftPhase) * 8;
    const baseHue = 200 + hueShift;

    gradient.addColorStop(0, `hsla(${baseHue}, 75%, 80%, 0.85)`);
    gradient.addColorStop(0.15, `hsla(${baseHue + 3}, 70%, 70%, 0.6)`);
    gradient.addColorStop(0.35, `hsla(${baseHue + 6}, 65%, 60%, 0.35)`);
    gradient.addColorStop(0.6, `hsla(${baseHue + 10}, 55%, 50%, 0.15)`);
    gradient.addColorStop(0.85, `hsla(${baseHue + 15}, 50%, 42%, 0.05)`);
    gradient.addColorStop(1, `hsla(${baseHue + 20}, 45%, 35%, 0)`);

    ctx.fillStyle = gradient;

    // Draw with dappled edges using bezier curves
    ctx.beginPath();
    ctx.moveTo(-halfWidth * this.getEdgeVariation(ray, 0), 0);

    // Left edge with organic variation
    const segments = ray.edgeSeeds.length;
    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const y = t * rayHeight;
      const prevY = ((i - 1) / segments) * rayHeight;

      // Taper the width as we go down
      const taper = 1 - t * 0.4;
      const variation = this.getEdgeVariation(ray, i - 1);
      const x = -halfWidth * taper * variation;

      const cpY = (prevY + y) / 2;
      const cpX = x + (Math.random() - 0.5) * halfWidth * 0.1;

      ctx.quadraticCurveTo(cpX, cpY, x, y);
    }

    // Bottom (pointed)
    ctx.lineTo(0, rayHeight * 1.02);

    // Right edge with organic variation
    for (let i = segments; i >= 0; i--) {
      const t = i / segments;
      const y = t * rayHeight;
      const nextY = ((i + 1) / segments) * rayHeight;

      const taper = 1 - t * 0.4;
      const variation = this.getEdgeVariation(ray, i + segments);
      const x = halfWidth * taper * variation;

      if (i < segments) {
        const cpY = (nextY + y) / 2;
        const cpX = x + (Math.random() - 0.5) * halfWidth * 0.1;
        ctx.quadraticCurveTo(cpX, cpY, x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  /**
   * Get edge variation based on seed
   */
  private getEdgeVariation(ray: LightRay, index: number): number {
    const seedIndex = index % ray.edgeSeeds.length;
    const seed = ray.edgeSeeds[seedIndex] ?? 0.5;
    // Variation between 0.85 and 1.15
    return 0.85 + seed * 0.3;
  }

  /**
   * Draw visible dust particles in the light beam
   */
  private drawDustParticles(
    ctx: CanvasRenderingContext2D,
    ray: LightRay,
    rayHeight: number,
    quality: string
  ): void {
    // Only render dust on medium/high quality
    if (quality === "low" || ray.dustParticles.length === 0) return;

    ctx.save();

    for (const dust of ray.dustParticles) {
      // Only draw if within ray bounds
      if (dust.y > rayHeight) continue;

      // Calculate opacity based on position (brighter near top)
      const depthFade = 1 - (dust.y / rayHeight) * 0.7;
      const alpha = dust.opacity * ray.opacity * depthFade;

      ctx.globalAlpha = alpha;

      // Dust sparkle effect
      const sparkle = 0.5 + Math.sin(dust.phase * 3) * 0.5;

      const gradient = ctx.createRadialGradient(
        dust.x,
        dust.y,
        0,
        dust.x,
        dust.y,
        dust.size * 2
      );
      gradient.addColorStop(0, `rgba(255, 255, 255, ${sparkle})`);
      gradient.addColorStop(0.4, `rgba(200, 230, 255, ${sparkle * 0.5})`);
      gradient.addColorStop(1, "rgba(180, 220, 255, 0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(dust.x, dust.y, dust.size * 2, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw caustic patterns (dancing light on ocean floor)
   */
  drawCaustics(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    caustics: CausticsState,
    quality: string
  ): void {
    if (quality === "minimal" || quality === "low") return;

    ctx.save();

    // Apply drift offset
    ctx.translate(caustics.driftX, caustics.driftY);

    for (const cell of caustics.cells) {
      this.drawCausticCell(ctx, cell, caustics.globalPhase);
    }

    ctx.restore();
  }

  private drawCausticCell(
    ctx: CanvasRenderingContext2D,
    cell: { x: number; y: number; size: number; intensity: number; phase: number },
    globalPhase: number
  ): void {
    const combinedPhase = cell.phase + globalPhase;
    const pulse = 0.5 + Math.sin(combinedPhase) * 0.5;
    const alpha = cell.intensity * pulse;

    if (alpha < 0.005) return;

    ctx.save();
    ctx.globalAlpha = alpha;

    // Caustic shape (organic, wobbly circle)
    const wobble1 = Math.sin(combinedPhase * 2) * 0.15;
    const wobble2 = Math.cos(combinedPhase * 1.7) * 0.15;

    const gradient = ctx.createRadialGradient(
      cell.x,
      cell.y,
      0,
      cell.x,
      cell.y,
      cell.size
    );
    gradient.addColorStop(0, "rgba(150, 220, 255, 0.4)");
    gradient.addColorStop(0.3, "rgba(130, 200, 240, 0.25)");
    gradient.addColorStop(0.6, "rgba(100, 180, 230, 0.1)");
    gradient.addColorStop(1, "rgba(80, 160, 220, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();

    // Draw organic caustic shape with bezier curves
    const points = 6;
    for (let i = 0; i <= points; i++) {
      const angle = (i / points) * Math.PI * 2;
      const radiusVariation =
        1 + Math.sin(angle * 3 + combinedPhase) * wobble1 +
        Math.cos(angle * 2 + combinedPhase) * wobble2;
      const r = cell.size * radiusVariation;
      const px = cell.x + Math.cos(angle) * r;
      const py = cell.y + Math.sin(angle) * r;

      if (i === 0) {
        ctx.moveTo(px, py);
      } else {
        const prevAngle = ((i - 1) / points) * Math.PI * 2;
        const cpAngle = (angle + prevAngle) / 2;
        const cpR = cell.size * (1 + Math.sin(cpAngle * 4 + combinedPhase) * 0.1);
        const cpX = cell.x + Math.cos(cpAngle) * cpR;
        const cpY = cell.y + Math.sin(cpAngle) * cpR;
        ctx.quadraticCurveTo(cpX, cpY, px, py);
      }
    }

    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}
