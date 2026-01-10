import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { RainbowBand } from "../domain/models/rainbow-models";
import { RAINBOW_ANIMATION, darkenForBackground } from "../domain/constants/rainbow-constants";

/**
 * RainbowGradientSystem - Renders flowing rainbow wave bands
 *
 * Creates horizontal color bands that flow with sine wave animation,
 * creating a fabric-like flowing rainbow effect.
 */
export class RainbowGradientSystem {
  private bands: RainbowBand[] = [];
  private animationTime = 0;

  /**
   * Initialize bands with given colors
   */
  public initialize(colors: string[], brightColors: string[], bandCount: number): void {
    this.bands = [];
    this.animationTime = Math.random() * Math.PI * 2; // Random start phase

    // Distribute bands evenly across the screen
    const bandHeight = 1 / bandCount;

    for (let i = 0; i < bandCount; i++) {
      const colorIndex = i % colors.length;
      this.bands.push({
        baseY: (i + 0.5) * bandHeight,
        wavePhase: Math.random() * Math.PI * 2,
        waveSpeed: RAINBOW_ANIMATION.waveSpeed * (0.8 + Math.random() * 0.4),
        amplitude: RAINBOW_ANIMATION.waveAmplitude * (0.8 + Math.random() * 0.4),
        color: colors[colorIndex] || "#000000",
        brightColor: brightColors[colorIndex] || "#ffffff",
        opacity: 0.7 + Math.random() * 0.3,
        height: bandHeight * 1.5, // Overlap for smooth blending
      });
    }
  }

  /**
   * Update animation state
   */
  public update(accessibility: AccessibilitySettings, frameMultiplier: number): void {
    const speedMult = accessibility.reducedMotion ? RAINBOW_ANIMATION.reducedMotionMultiplier : 1;
    const effectiveMultiplier = frameMultiplier * speedMult;

    this.animationTime += 0.016 * effectiveMultiplier;

    for (const band of this.bands) {
      band.wavePhase += band.waveSpeed * effectiveMultiplier;

      // Wrap phase to prevent overflow
      if (band.wavePhase > Math.PI * 4) {
        band.wavePhase -= Math.PI * 4;
      }
    }
  }

  /**
   * Draw wave bands
   */
  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const { width, height } = dimensions;

    for (const band of this.bands) {
      this.drawWaveBand(ctx, band, width, height);
    }
  }

  /**
   * Draw a single wave band with gradient falloff
   */
  private drawWaveBand(
    ctx: CanvasRenderingContext2D,
    band: RainbowBand,
    width: number,
    height: number
  ): void {
    const bandPixelHeight = band.height * height;
    const baseY = band.baseY * height;

    ctx.save();

    // Draw the wave band using a path
    ctx.beginPath();

    // Start from left edge
    const startY = this.getWaveY(0, band, width, height);
    ctx.moveTo(0, startY - bandPixelHeight / 2);

    // Draw top edge with wave
    for (let x = 0; x <= width; x += 4) {
      const waveY = this.getWaveY(x, band, width, height);
      ctx.lineTo(x, waveY - bandPixelHeight / 2);
    }

    // Draw bottom edge (reverse direction)
    for (let x = width; x >= 0; x -= 4) {
      const waveY = this.getWaveY(x, band, width, height);
      ctx.lineTo(x, waveY + bandPixelHeight / 2);
    }

    ctx.closePath();

    // Create vertical gradient for soft edges
    const gradient = ctx.createLinearGradient(0, baseY - bandPixelHeight, 0, baseY + bandPixelHeight);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.2, this.addAlpha(band.color, band.opacity * 0.5));
    gradient.addColorStop(0.4, this.addAlpha(band.color, band.opacity));
    gradient.addColorStop(0.6, this.addAlpha(band.color, band.opacity));
    gradient.addColorStop(0.8, this.addAlpha(band.color, band.opacity * 0.5));
    gradient.addColorStop(1, "transparent");

    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.restore();
  }

  /**
   * Calculate Y position with wave effect
   */
  private getWaveY(x: number, band: RainbowBand, width: number, height: number): number {
    const baseY = band.baseY * height;
    const waveOffset =
      Math.sin(x * RAINBOW_ANIMATION.waveFrequency + band.wavePhase + this.animationTime) *
      band.amplitude *
      height *
      0.1;
    return baseY + waveOffset;
  }

  /**
   * Add alpha to hex color
   */
  private addAlpha(hex: string, alpha: number): string {
    const rgb = this.hexToRgb(hex);
    if (!rgb) return hex;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
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
   * Get current bands for stats
   */
  public getBands(): RainbowBand[] {
    return this.bands;
  }

  /**
   * Update palette colors
   */
  public updateColors(colors: string[], brightColors: string[]): void {
    for (let i = 0; i < this.bands.length; i++) {
      const band = this.bands[i];
      if (!band) continue;
      const colorIndex = i % colors.length;
      band.color = colors[colorIndex] || "#000000";
      band.brightColor = brightColors[colorIndex] || "#ffffff";
    }
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    this.bands = [];
    this.animationTime = 0;
  }
}
