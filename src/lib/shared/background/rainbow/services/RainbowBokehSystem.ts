import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { BokehOrb } from "../domain/models/rainbow-models";
import { RAINBOW_ANIMATION } from "../domain/constants/rainbow-constants";

/**
 * RainbowBokehSystem - Soft circular light orbs with parallax depth
 *
 * Creates dreamy, out-of-focus light circles that drift slowly
 * across the screen at different depth layers.
 */
export class RainbowBokehSystem {
  private orbs: BokehOrb[] = [];

  /**
   * Initialize bokeh orbs
   */
  public initialize(colors: string[], count: number): void {
    this.orbs = [];

    for (let i = 0; i < count; i++) {
      this.orbs.push(this.createOrb(colors));
    }
  }

  /**
   * Create a single bokeh orb
   */
  private createOrb(colors: string[]): BokehOrb {
    const depth = 0.5 + Math.random(); // 0.5 to 1.5

    return {
      x: Math.random(),
      y: Math.random(),
      size: 30 + Math.random() * 80 * depth, // Larger orbs appear closer
      color: colors[Math.floor(Math.random() * colors.length)] || "#ffffff",
      opacity: 0.1 + Math.random() * 0.2,
      depth,
      dx: (Math.random() - 0.5) * RAINBOW_ANIMATION.bokehDriftSpeed,
      dy: (Math.random() - 0.5) * RAINBOW_ANIMATION.bokehDriftSpeed * 0.5,
      pulsePhase: Math.random() * Math.PI * 2,
      pulseSpeed: 0.005 + Math.random() * 0.01,
    };
  }

  /**
   * Update bokeh animation
   */
  public update(accessibility: AccessibilitySettings, frameMultiplier: number): void {
    const speedMult = accessibility.reducedMotion ? 0.2 : 1;
    const effectiveMultiplier = frameMultiplier * speedMult;

    for (const orb of this.orbs) {
      // Drift movement
      orb.x += orb.dx * effectiveMultiplier;
      orb.y += orb.dy * effectiveMultiplier;

      // Pulse opacity
      orb.pulsePhase += orb.pulseSpeed * effectiveMultiplier;
      const pulseFactor = 0.7 + Math.sin(orb.pulsePhase) * 0.3;
      orb.opacity = (0.1 + Math.random() * 0.1) * pulseFactor;

      // Wrap around edges
      if (orb.x < -0.1) orb.x = 1.1;
      if (orb.x > 1.1) orb.x = -0.1;
      if (orb.y < -0.1) orb.y = 1.1;
      if (orb.y > 1.1) orb.y = -0.1;
    }
  }

  /**
   * Draw bokeh orbs
   */
  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const { width, height } = dimensions;

    // Sort by depth (far to near)
    const sortedOrbs = [...this.orbs].sort((a, b) => a.depth - b.depth);

    for (const orb of sortedOrbs) {
      this.drawOrb(ctx, orb, width, height);
    }
  }

  /**
   * Draw a single bokeh orb with soft blur effect
   */
  private drawOrb(ctx: CanvasRenderingContext2D, orb: BokehOrb, width: number, height: number): void {
    const x = orb.x * width;
    const y = orb.y * height;
    const size = orb.size;

    ctx.save();

    // Create radial gradient for soft bokeh effect
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, size);

    const rgb = this.hexToRgb(orb.color);
    if (rgb) {
      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${orb.opacity})`);
      gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${orb.opacity * 0.7})`);
      gradient.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${orb.opacity * 0.3})`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);
    }

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
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
   * Get orbs for stats
   */
  public getOrbs(): BokehOrb[] {
    return this.orbs;
  }

  /**
   * Update palette colors
   */
  public updateColors(colors: string[]): void {
    for (const orb of this.orbs) {
      orb.color = colors[Math.floor(Math.random() * colors.length)] || "#ffffff";
    }
  }

  /**
   * Cleanup
   */
  public cleanup(): void {
    this.orbs = [];
  }
}
