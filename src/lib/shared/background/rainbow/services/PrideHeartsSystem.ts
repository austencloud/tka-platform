import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { PrideHeart } from "../domain/models/rainbow-models";
import { RAINBOW_ANIMATION } from "../domain/constants/rainbow-constants";

/**
 * PrideHeartsSystem - Floating heart shapes (high quality only)
 *
 * Creates occasional floating heart shapes that drift upward
 * with gentle sway, adding a celebratory Pride element.
 */
export class PrideHeartsSystem {
  private hearts: PrideHeart[] = [];

  /**
   * Initialize hearts
   */
  public initialize(colors: string[], count: number): void {
    this.hearts = [];

    for (let i = 0; i < count; i++) {
      this.hearts.push(this.createHeart(colors));
    }
  }

  /**
   * Create a single heart
   */
  private createHeart(colors: string[]): PrideHeart {
    return {
      x: Math.random(),
      y: Math.random(),
      size: 15 + Math.random() * 25,
      color: colors[Math.floor(Math.random() * colors.length)] || "#ff69b4",
      opacity: 0.3 + Math.random() * 0.3,
      rotation: (Math.random() - 0.5) * 0.3,
      floatSpeed: RAINBOW_ANIMATION.heartFloatSpeed * (0.8 + Math.random() * 0.4),
      swayPhase: Math.random() * Math.PI * 2,
      swaySpeed: RAINBOW_ANIMATION.heartSwaySpeed * (0.8 + Math.random() * 0.4),
    };
  }

  /**
   * Update heart animation
   */
  public update(
    accessibility: AccessibilitySettings,
    frameMultiplier: number,
    colors: string[]
  ): void {
    if (accessibility.reducedMotion) {
      // Static hearts in reduced motion mode
      return;
    }

    const effectiveMultiplier = frameMultiplier;

    for (const heart of this.hearts) {
      // Float upward
      heart.y -= heart.floatSpeed * effectiveMultiplier;

      // Gentle sway
      heart.swayPhase += heart.swaySpeed * effectiveMultiplier;
      heart.x += Math.sin(heart.swayPhase) * RAINBOW_ANIMATION.heartSwayAmplitude * 0.01;

      // Slight rotation wobble
      heart.rotation = Math.sin(heart.swayPhase * 0.5) * 0.15;

      // Reset when off screen
      if (heart.y < -0.1) {
        heart.y = 1.1;
        heart.x = Math.random();
        heart.color = colors[Math.floor(Math.random() * colors.length)] || "#ff69b4";
        heart.opacity = 0.3 + Math.random() * 0.3;
      }
    }
  }

  /**
   * Draw hearts
   */
  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const { width, height } = dimensions;

    for (const heart of this.hearts) {
      this.drawHeart(ctx, heart, width, height);
    }
  }

  /**
   * Draw a single heart shape
   */
  private drawHeart(
    ctx: CanvasRenderingContext2D,
    heart: PrideHeart,
    width: number,
    height: number
  ): void {
    const x = heart.x * width;
    const y = heart.y * height;
    const size = heart.size;

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(heart.rotation);

    const rgb = this.hexToRgb(heart.color);
    if (!rgb) {
      ctx.restore();
      return;
    }

    // Heart glow
    const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, size * 2);
    glowGradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${heart.opacity * 0.5})`);
    glowGradient.addColorStop(0.5, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${heart.opacity * 0.2})`);
    glowGradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

    ctx.fillStyle = glowGradient;
    ctx.beginPath();
    ctx.arc(0, 0, size * 2, 0, Math.PI * 2);
    ctx.fill();

    // Heart shape
    ctx.fillStyle = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${heart.opacity})`;
    ctx.beginPath();

    // Draw heart using bezier curves
    const scale = size / 30;
    ctx.moveTo(0, scale * 8);

    // Left curve
    ctx.bezierCurveTo(
      scale * -20,
      scale * -10,
      scale * -40,
      scale * 10,
      0,
      scale * 30
    );

    // Right curve
    ctx.bezierCurveTo(
      scale * 40,
      scale * 10,
      scale * 20,
      scale * -10,
      0,
      scale * 8
    );

    ctx.fill();

    ctx.restore();
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result || !result[1] || !result[2] || !result[3]) return null;
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    };
  }

  /**
   * Get hearts for stats
   */
  public getHearts(): PrideHeart[] {
    return this.hearts;
  }

  /**
   * Update palette colors
   */
  public updateColors(colors: string[]): void {
    for (const heart of this.hearts) {
      heart.color = colors[Math.floor(Math.random() * colors.length)] || "#ff69b4";
    }
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    this.hearts = [];
  }
}
