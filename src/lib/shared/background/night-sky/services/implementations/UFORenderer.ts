/**
 * UFORenderer - Renders the UFO's visual components
 *
 * Handles all drawing operations for the UFO hull, dome, shield, beam, lights, and engine glow.
 * Pure rendering with no state mutation.
 */

import type { AccessibilitySettings } from "../../../shared/domain/models/background-models";
import type { IUFORenderer } from "../contracts/IUFORenderer";
import type {
  UFOConfig,
  UFORenderState,
  WobbleOffset,
  MoodVisuals,
} from "../domain/ufo-types";

export class UFORenderer implements IUFORenderer {
  draw(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    a11y: AccessibilitySettings,
    moodVisuals: MoodVisuals,
    wobble: WobbleOffset
  ): void {
    const baseAlpha = a11y.reducedMotion ? 0.7 : 1;

    ctx.save();
    ctx.globalAlpha = ufo.opacity * baseAlpha;

    // Calculate hover bob offset with mood-based depth
    const bobOffset =
      Math.sin(ufo.hoverPhase) * config.hoverBobAmount * moodVisuals.bobDepth;

    // Apply wobble offsets
    const drawX = ufo.x + wobble.x;
    const drawY = ufo.y + bobOffset + wobble.y;

    // Apply scale transform (for zoom entrance/exit + wobble scale)
    const totalScale = ufo.scale * wobble.scale;
    if (totalScale !== 1 || wobble.rotation !== 0) {
      ctx.translate(drawX, drawY);
      if (totalScale !== 1) ctx.scale(totalScale, totalScale);
      if (wobble.rotation !== 0) ctx.rotate(wobble.rotation);
      ctx.translate(-drawX, -drawY);
    }

    // Layer 0: Warp flash effect
    if (ufo.flashIntensity > 0) {
      this.drawWarpFlash(ctx, ufo, drawY);
    }

    // Layer 1: Tractor beam
    if (ufo.beamTarget && ufo.beamIntensity > 0) {
      this.drawBeam(ctx, ufo, config, drawY);
    }

    // Layer 2: Shield glow
    this.drawShield(ctx, ufo, config, drawY, moodVisuals);

    // Layer 3: Hull
    this.drawHull(ctx, ufo, config, drawY, a11y);

    // Layer 4: Dome
    this.drawDome(ctx, ufo, config, drawY);

    // Layer 5: Rim lights
    this.drawLights(ctx, ufo, config, drawY);

    // Layer 6: Engine glow
    this.drawEngineGlow(ctx, ufo, config, drawY);

    ctx.restore();
  }

  drawWarpFlash(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    drawY: number
  ): void {
    const flashRadius = ufo.size * (1.5 + ufo.flashIntensity * 2);

    const gradient = ctx.createRadialGradient(
      ufo.x,
      drawY,
      0,
      ufo.x,
      drawY,
      flashRadius
    );

    gradient.addColorStop(
      0,
      `rgba(200, 230, 255, ${0.9 * ufo.flashIntensity})`
    );
    gradient.addColorStop(
      0.3,
      `rgba(150, 200, 255, ${0.5 * ufo.flashIntensity})`
    );
    gradient.addColorStop(0.7, `rgba(100, 150, 255, ${0.2 * ufo.flashIntensity})`);
    gradient.addColorStop(1, "rgba(100, 150, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ufo.x, drawY, flashRadius, 0, Math.PI * 2);
    ctx.fill();
  }

  drawBeam(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void {
    if (!ufo.beamTarget) return;

    const { x } = ufo;
    const target = ufo.beamTarget;

    // Calculate beam direction and length
    const dx = target.x - x;
    const dy = target.y - drawY;
    const length = Math.sqrt(dx * dx + dy * dy);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.translate(x, drawY);
    ctx.rotate(angle);

    // Beam width at source and end
    const sourceWidth = ufo.size * 0.3;
    const endWidth = ufo.size * 1.5;

    // Pulsing intensity
    const pulseIntensity =
      0.7 + Math.sin(ufo.beamPhase * 3) * 0.3 * ufo.beamIntensity;

    // Draw beam cone
    const gradient = ctx.createLinearGradient(0, 0, length, 0);
    const beamColor = config.colors.beam;
    gradient.addColorStop(
      0,
      this.colorWithAlpha(beamColor, 0.6 * ufo.beamIntensity * pulseIntensity)
    );
    gradient.addColorStop(
      0.3,
      this.colorWithAlpha(beamColor, 0.4 * ufo.beamIntensity * pulseIntensity)
    );
    gradient.addColorStop(1, this.colorWithAlpha(beamColor, 0));

    ctx.beginPath();
    ctx.moveTo(0, -sourceWidth / 2);
    ctx.lineTo(length, -endWidth / 2);
    ctx.lineTo(length, endWidth / 2);
    ctx.lineTo(0, sourceWidth / 2);
    ctx.closePath();

    ctx.fillStyle = gradient;
    ctx.fill();

    // Add glow overlay
    const glowGradient = ctx.createLinearGradient(0, 0, length * 0.5, 0);
    glowGradient.addColorStop(
      0,
      this.colorWithAlpha(
        config.colors.beamGlow,
        0.4 * ufo.beamIntensity * pulseIntensity
      )
    );
    glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = glowGradient;
    ctx.fill();

    ctx.restore();
  }

  drawShield(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number,
    moodVisuals: MoodVisuals
  ): void {
    const shieldRadius = ufo.size * 1.8;
    const pulseScale = 1 + Math.sin(ufo.shieldPhase) * 0.05;

    const brightness = moodVisuals.shieldBrightness;

    const gradient = ctx.createRadialGradient(
      ufo.x,
      drawY,
      0,
      ufo.x,
      drawY,
      shieldRadius * pulseScale
    );

    const shieldColor = config.colors.shield;
    gradient.addColorStop(0, this.colorWithAlpha(shieldColor, 0.1 * brightness));
    gradient.addColorStop(0.5, this.colorWithAlpha(shieldColor, 0.08 * brightness));
    gradient.addColorStop(0.8, this.colorWithAlpha(shieldColor, 0.03 * brightness));
    gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(ufo.x, drawY, shieldRadius * pulseScale, 0, Math.PI * 2);
    ctx.fill();
  }

  drawHull(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number,
    a11y: AccessibilitySettings
  ): void {
    const { size, x } = ufo;

    const bodyWidth = size;
    const bodyHeight = size * 0.25;

    // Main hull gradient (metallic)
    const hullGradient = ctx.createLinearGradient(
      x,
      drawY - bodyHeight,
      x,
      drawY + bodyHeight
    );

    const hullColor = a11y.highContrast ? "#ffffff" : config.colors.hull;
    const hullDark = a11y.highContrast ? "#cccccc" : config.colors.hullDark;

    hullGradient.addColorStop(0, hullColor);
    hullGradient.addColorStop(0.4, hullColor);
    hullGradient.addColorStop(0.6, hullDark);
    hullGradient.addColorStop(1, hullDark);

    ctx.fillStyle = hullGradient;
    ctx.beginPath();
    ctx.ellipse(x, drawY, bodyWidth, bodyHeight, 0, 0, Math.PI * 2);
    ctx.fill();

    // Subtle rim highlight
    ctx.strokeStyle = this.colorWithAlpha(hullColor, 0.5);
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  drawDome(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void {
    const { size, x } = ufo;

    const domeWidth = size * 0.4;
    const domeHeight = size * 0.35;
    const domeY = drawY - size * 0.15;

    // Glass dome gradient
    const domeGradient = ctx.createRadialGradient(
      x - domeWidth * 0.2,
      domeY - domeHeight * 0.3,
      0,
      x,
      domeY,
      domeWidth
    );

    domeGradient.addColorStop(0, config.colors.domeHighlight);
    domeGradient.addColorStop(0.3, config.colors.dome);
    domeGradient.addColorStop(1, this.colorWithAlpha(config.colors.dome, 0.3));

    ctx.fillStyle = domeGradient;
    ctx.beginPath();
    ctx.ellipse(x, domeY, domeWidth, domeHeight, 0, Math.PI, 0);
    ctx.fill();
  }

  drawLights(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void {
    const { size, x } = ufo;
    const colors = config.colors.lights;
    const numLights = colors.length;
    const lightRadius = size * 0.06;
    const orbitRadius = size * 0.85;

    for (let i = 0; i < numLights; i++) {
      const color = colors[i] ?? "#ffffff";
      const angle = (i / numLights) * Math.PI * 2 + ufo.lightPhase;

      // Chase pattern - each light pulses in sequence
      const chaseOffset = (ufo.lightPhase * 2 + i) % numLights;
      const brightness = 0.4 + Math.sin(chaseOffset * 0.5) * 0.6;

      const lx = x + Math.cos(angle) * orbitRadius;
      const ly = drawY + Math.sin(angle) * orbitRadius * 0.3;

      // Light glow
      const glowGradient = ctx.createRadialGradient(
        lx,
        ly,
        0,
        lx,
        ly,
        lightRadius * 3
      );
      glowGradient.addColorStop(0, this.colorWithAlpha(color, brightness * 0.8));
      glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(lx, ly, lightRadius * 3, 0, Math.PI * 2);
      ctx.fill();

      // Light core
      ctx.fillStyle = this.colorWithAlpha(color, brightness);
      ctx.beginPath();
      ctx.arc(lx, ly, lightRadius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawEngineGlow(
    ctx: CanvasRenderingContext2D,
    ufo: UFORenderState,
    config: UFOConfig,
    drawY: number
  ): void {
    const { size, x } = ufo;

    // Subtle glow underneath
    const glowGradient = ctx.createRadialGradient(
      x,
      drawY + size * 0.1,
      0,
      x,
      drawY + size * 0.1,
      size * 0.5
    );

    const pulse = 0.3 + Math.sin(ufo.shieldPhase * 2) * 0.1;
    glowGradient.addColorStop(0, `rgba(150, 200, 255, ${pulse})`);
    glowGradient.addColorStop(0.5, `rgba(100, 150, 255, ${pulse * 0.5})`);
    glowGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.ellipse(x, drawY + size * 0.1, size * 0.5, size * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Convert a color to rgba with specified alpha
   */
  private colorWithAlpha(color: string, alpha: number): string {
    // Handle hex colors
    if (color.startsWith("#")) {
      const hex = color.slice(1);
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    // Handle rgba - replace alpha
    if (color.startsWith("rgba")) {
      return color.replace(/[\d.]+\)$/, `${alpha})`);
    }
    return color;
  }
}
