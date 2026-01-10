import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { Sparkle } from "../domain/models/rainbow-models";
import { RAINBOW_ANIMATION } from "../domain/constants/rainbow-constants";

/**
 * RainbowSparkleSystem - Small twinkling star particles
 *
 * Creates scattered sparkles across the screen that twinkle
 * with random timing, adding a magical quality to the background.
 */
export class RainbowSparkleSystem {
  private sparkles: Sparkle[] = [];

  /**
   * Initialize sparkles
   */
  public initialize(count: number, colors?: string[]): void {
    this.sparkles = [];

    for (let i = 0; i < count; i++) {
      this.sparkles.push(this.createSparkle(colors));
    }
  }

  /**
   * Create a single sparkle
   */
  private createSparkle(colors?: string[]): Sparkle {
    return {
      x: Math.random(),
      y: Math.random(),
      size: 1 + Math.random() * 3,
      opacity: Math.random(),
      twinklePhase: Math.random() * Math.PI * 2,
      twinkleSpeed:
        RAINBOW_ANIMATION.sparkleSpeedMin +
        Math.random() * (RAINBOW_ANIMATION.sparkleSpeedMax - RAINBOW_ANIMATION.sparkleSpeedMin),
      tint: colors ? colors[Math.floor(Math.random() * colors.length)] : undefined,
    };
  }

  /**
   * Update sparkle animation
   */
  public update(accessibility: AccessibilitySettings, frameMultiplier: number): void {
    if (accessibility.reducedMotion) {
      // Static sparkles in reduced motion mode
      return;
    }

    const effectiveMultiplier = frameMultiplier;

    for (const sparkle of this.sparkles) {
      sparkle.twinklePhase += sparkle.twinkleSpeed * effectiveMultiplier;

      // Calculate opacity with twinkle effect
      const twinkleFactor = (Math.sin(sparkle.twinklePhase) + 1) / 2;
      sparkle.opacity = 0.2 + twinkleFactor * 0.8;

      // Wrap phase
      if (sparkle.twinklePhase > Math.PI * 4) {
        sparkle.twinklePhase -= Math.PI * 4;
      }
    }
  }

  /**
   * Draw sparkles
   */
  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const { width, height } = dimensions;

    for (const sparkle of this.sparkles) {
      this.drawSparkle(ctx, sparkle, width, height);
    }
  }

  /**
   * Draw a single sparkle (4-point star shape)
   */
  private drawSparkle(
    ctx: CanvasRenderingContext2D,
    sparkle: Sparkle,
    width: number,
    height: number
  ): void {
    const x = sparkle.x * width;
    const y = sparkle.y * height;
    const size = sparkle.size;

    ctx.save();

    // Use tint color if available, otherwise white
    let color = "255, 255, 255";
    if (sparkle.tint) {
      const rgb = this.hexToRgb(sparkle.tint);
      if (rgb) {
        // Blend with white for subtle tint
        color = `${Math.round(rgb.r * 0.3 + 255 * 0.7)}, ${Math.round(rgb.g * 0.3 + 255 * 0.7)}, ${Math.round(rgb.b * 0.3 + 255 * 0.7)}`;
      }
    }

    ctx.fillStyle = `rgba(${color}, ${sparkle.opacity})`;

    // Draw 4-point star shape
    ctx.beginPath();

    // Vertical line
    ctx.moveTo(x, y - size);
    ctx.lineTo(x, y + size);

    // Horizontal line
    ctx.moveTo(x - size, y);
    ctx.lineTo(x + size, y);

    ctx.lineWidth = Math.max(0.5, size * 0.3);
    ctx.strokeStyle = `rgba(${color}, ${sparkle.opacity})`;
    ctx.stroke();

    // Center glow
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
    gradient.addColorStop(0, `rgba(${color}, ${sparkle.opacity * 0.8})`);
    gradient.addColorStop(0.5, `rgba(${color}, ${sparkle.opacity * 0.3})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
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
   * Get sparkles for stats
   */
  public getSparkles(): Sparkle[] {
    return this.sparkles;
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    this.sparkles = [];
  }
}
