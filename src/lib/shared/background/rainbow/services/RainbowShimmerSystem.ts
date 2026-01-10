import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { ShimmerPoint } from "../domain/models/rainbow-models";
import { RAINBOW_ANIMATION } from "../domain/constants/rainbow-constants";

/**
 * RainbowShimmerSystem - Light shimmer effects across bands
 *
 * Creates traveling waves of brightness across the rainbow bands,
 * simulating light catching on fabric or aurora-like shimmer.
 */
export class RainbowShimmerSystem {
  private shimmerPoints: ShimmerPoint[] = [];
  private wavePhase = 0;

  /**
   * Initialize shimmer points
   */
  public initialize(count: number): void {
    this.shimmerPoints = [];
    this.wavePhase = Math.random() * Math.PI * 2;

    for (let i = 0; i < count; i++) {
      this.shimmerPoints.push({
        x: Math.random(),
        y: Math.random(),
        intensity: 0,
        phase: Math.random() * Math.PI * 2,
        size: 50 + Math.random() * 100,
      });
    }
  }

  /**
   * Update shimmer animation
   */
  public update(accessibility: AccessibilitySettings, frameMultiplier: number): void {
    if (accessibility.reducedMotion) {
      // Static shimmer in reduced motion mode
      for (const point of this.shimmerPoints) {
        point.intensity = 0.3;
      }
      return;
    }

    const effectiveMultiplier = frameMultiplier;
    this.wavePhase += RAINBOW_ANIMATION.shimmerSpeed * effectiveMultiplier;

    // Wrap phase
    if (this.wavePhase > Math.PI * 4) {
      this.wavePhase -= Math.PI * 4;
    }

    // Update each shimmer point's intensity based on traveling wave
    for (const point of this.shimmerPoints) {
      // Create traveling wave effect (left to right)
      const wavePosition = (point.x * 4 + point.phase + this.wavePhase) % (Math.PI * 2);
      point.intensity = Math.max(0, Math.sin(wavePosition)) * 0.5;
    }
  }

  /**
   * Draw shimmer effects
   */
  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const { width, height } = dimensions;

    ctx.save();

    // Use additive blending for light shimmer
    ctx.globalCompositeOperation = "screen";

    for (const point of this.shimmerPoints) {
      if (point.intensity < 0.05) continue;

      this.drawShimmerPoint(ctx, point, width, height);
    }

    ctx.restore();
  }

  /**
   * Draw a single shimmer point
   */
  private drawShimmerPoint(
    ctx: CanvasRenderingContext2D,
    point: ShimmerPoint,
    width: number,
    height: number
  ): void {
    const x = point.x * width;
    const y = point.y * height;
    const size = point.size;

    // Create soft radial gradient for shimmer
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);
    const alpha = point.intensity * 0.4;

    gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
    gradient.addColorStop(0.3, `rgba(255, 255, 255, ${alpha * 0.5})`);
    gradient.addColorStop(0.6, `rgba(255, 255, 255, ${alpha * 0.2})`);
    gradient.addColorStop(1, "rgba(255, 255, 255, 0)");

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Get shimmer points for stats
   */
  public getShimmerPoints(): ShimmerPoint[] {
    return this.shimmerPoints;
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    this.shimmerPoints = [];
    this.wavePhase = 0;
  }
}
