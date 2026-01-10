import type { Dimensions } from "$lib/shared/background/shared/domain/types/background-types";
import type {
  GradientState,
  DistantGlow,
  FogLayer,
} from "../../domain/models/DeepOceanModels";
import type { IGradientRenderer } from "../contracts/IGradientRenderer";

/**
 * Gradient Configuration
 * Tuned for atmospheric, living ocean depth
 */
const GRADIENT_CONFIG = {
  // Base colors (HSL for easy breathing animation)
  colors: {
    surface: { h: 205, s: 65, l: 17 }, // #0d2d47
    midDepth: { h: 195, s: 45, l: 20 }, // #1a3a4a
    deep: { h: 205, s: 55, l: 13 }, // #0f2535
    abyss: { h: 210, s: 50, l: 10 }, // #091a2b
  },

  // Breathing animation
  breathingSpeed: 0.0003, // Very slow
  breathingRange: {
    hue: 5, // ±5 degrees
    saturation: 8, // ±8%
    lightness: 3, // ±3%
  },

  // Fog layers
  fogLayerCount: 3,
  fogOpacity: { min: 0.02, max: 0.06 },
  fogSpeed: { min: 0.001, max: 0.003 },

  // Distant bioluminescence
  glowCount: { min: 4, max: 8 },
  glowSize: { min: 40, max: 120 },
  glowIntensity: { min: 0.015, max: 0.04 },
  glowSpeed: { min: 0.003, max: 0.008 },
  glowColors: ["#4db8ff", "#7b68ee", "#00ced1", "#9370db"], // Cyan, purple, teal, violet

  // Vignette
  vignetteIntensity: 0.25,
  vignetteRadius: 0.7, // Start at 70% from center
};

export class GradientRenderer implements IGradientRenderer {
  initializeGradientState(dimensions: Dimensions): GradientState {
    return {
      breathingPhase: Math.random() * Math.PI * 2,
      breathingSpeed: GRADIENT_CONFIG.breathingSpeed,

      fogLayers: this.createFogLayers(dimensions),
      distantGlows: this.createDistantGlows(dimensions),

      vignetteIntensity: GRADIENT_CONFIG.vignetteIntensity,
    };
  }

  private createFogLayers(dimensions: Dimensions): FogLayer[] {
    const layers: FogLayer[] = [];
    for (let i = 0; i < GRADIENT_CONFIG.fogLayerCount; i++) {
      layers.push({
        y: (i + 1) / (GRADIENT_CONFIG.fogLayerCount + 1) * dimensions.height,
        opacity: this.randomInRange(
          GRADIENT_CONFIG.fogOpacity.min,
          GRADIENT_CONFIG.fogOpacity.max
        ),
        phase: Math.random() * Math.PI * 2,
        speed: this.randomInRange(
          GRADIENT_CONFIG.fogSpeed.min,
          GRADIENT_CONFIG.fogSpeed.max
        ),
      });
    }
    return layers;
  }

  private createDistantGlows(dimensions: Dimensions): DistantGlow[] {
    const count = this.randomIntInRange(
      GRADIENT_CONFIG.glowCount.min,
      GRADIENT_CONFIG.glowCount.max
    );

    const glows: DistantGlow[] = [];
    for (let i = 0; i < count; i++) {
      const color = GRADIENT_CONFIG.glowColors[
        Math.floor(Math.random() * GRADIENT_CONFIG.glowColors.length)
      ] ?? GRADIENT_CONFIG.glowColors[0]!;

      glows.push({
        x: Math.random() * dimensions.width,
        y: dimensions.height * 0.3 + Math.random() * dimensions.height * 0.6, // Middle-lower portion
        size: this.randomInRange(
          GRADIENT_CONFIG.glowSize.min,
          GRADIENT_CONFIG.glowSize.max
        ),
        intensity: this.randomInRange(
          GRADIENT_CONFIG.glowIntensity.min,
          GRADIENT_CONFIG.glowIntensity.max
        ),
        phase: Math.random() * Math.PI * 2,
        speed: this.randomInRange(
          GRADIENT_CONFIG.glowSpeed.min,
          GRADIENT_CONFIG.glowSpeed.max
        ),
        color,
      });
    }
    return glows;
  }

  updateGradientState(
    state: GradientState,
    frameMultiplier: number
  ): GradientState {
    // Update breathing phase
    const newBreathingPhase =
      state.breathingPhase + state.breathingSpeed * frameMultiplier;

    // Update fog layers
    const updatedFogLayers = state.fogLayers.map((layer) => ({
      ...layer,
      phase: layer.phase + layer.speed * frameMultiplier,
    }));

    // Update distant glows
    const updatedGlows = state.distantGlows.map((glow) => ({
      ...glow,
      phase: glow.phase + glow.speed * frameMultiplier,
    }));

    return {
      ...state,
      breathingPhase: newBreathingPhase,
      fogLayers: updatedFogLayers,
      distantGlows: updatedGlows,
    };
  }

  drawOceanGradient(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    state?: GradientState | null
  ): void {
    // Draw base gradient (always works even without state)
    this.drawBaseGradient(ctx, dimensions, state?.breathingPhase ?? 0);

    // Draw animated effects if state is provided
    if (state) {
      this.drawDepthFog(ctx, dimensions, state.fogLayers);
      this.drawDistantBioluminescence(ctx, state.distantGlows);
      this.drawVignette(ctx, dimensions, state.vignetteIntensity);
    }
  }

  /**
   * Draw the base ocean gradient with color breathing
   */
  private drawBaseGradient(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    breathingPhase: number
  ): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);
    const { colors, breathingRange } = GRADIENT_CONFIG;

    // Calculate breathing offsets
    const breathSin = Math.sin(breathingPhase);
    const hueOffset = breathSin * breathingRange.hue;
    const satOffset = breathSin * breathingRange.saturation;
    const lightOffset = Math.sin(breathingPhase * 0.7) * breathingRange.lightness;

    // Apply breathing to each color stop
    gradient.addColorStop(
      0,
      this.hsl(
        colors.surface.h + hueOffset,
        colors.surface.s + satOffset,
        colors.surface.l + lightOffset
      )
    );
    gradient.addColorStop(
      0.3,
      this.hsl(
        colors.midDepth.h + hueOffset * 0.7,
        colors.midDepth.s + satOffset * 0.5,
        colors.midDepth.l + lightOffset * 0.7
      )
    );
    gradient.addColorStop(
      0.7,
      this.hsl(
        colors.deep.h + hueOffset * 0.5,
        colors.deep.s + satOffset * 0.3,
        colors.deep.l + lightOffset * 0.5
      )
    );
    gradient.addColorStop(
      1,
      this.hsl(
        colors.abyss.h + hueOffset * 0.3,
        colors.abyss.s + satOffset * 0.2,
        colors.abyss.l + lightOffset * 0.3
      )
    );

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  /**
   * Draw horizontal depth fog layers
   */
  private drawDepthFog(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    fogLayers: FogLayer[]
  ): void {
    ctx.save();

    for (const layer of fogLayers) {
      const pulse = 0.5 + Math.sin(layer.phase) * 0.5;
      const alpha = layer.opacity * pulse;

      // Fog band gradient (horizontal haze)
      const fogHeight = dimensions.height * 0.15;
      const gradient = ctx.createLinearGradient(
        0,
        layer.y - fogHeight / 2,
        0,
        layer.y + fogHeight / 2
      );

      gradient.addColorStop(0, `rgba(100, 150, 180, 0)`);
      gradient.addColorStop(0.3, `rgba(80, 130, 160, ${alpha * 0.5})`);
      gradient.addColorStop(0.5, `rgba(70, 120, 150, ${alpha})`);
      gradient.addColorStop(0.7, `rgba(80, 130, 160, ${alpha * 0.5})`);
      gradient.addColorStop(1, `rgba(100, 150, 180, 0)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(0, layer.y - fogHeight / 2, dimensions.width, fogHeight);
    }

    ctx.restore();
  }

  /**
   * Draw distant bioluminescent glow spots
   */
  private drawDistantBioluminescence(
    ctx: CanvasRenderingContext2D,
    glows: DistantGlow[]
  ): void {
    ctx.save();

    for (const glow of glows) {
      const pulse = 0.3 + Math.sin(glow.phase) * 0.7;
      const alpha = glow.intensity * pulse;

      if (alpha < 0.005) continue;

      ctx.globalAlpha = alpha;

      // Parse color and create gradient
      const rgb = this.hexToRgb(glow.color);
      const gradient = ctx.createRadialGradient(
        glow.x,
        glow.y,
        0,
        glow.x,
        glow.y,
        glow.size
      );

      gradient.addColorStop(0, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6)`);
      gradient.addColorStop(0.3, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3)`);
      gradient.addColorStop(0.6, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`);
      gradient.addColorStop(1, `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(glow.x, glow.y, glow.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /**
   * Draw subtle edge vignette
   */
  private drawVignette(
    ctx: CanvasRenderingContext2D,
    dimensions: Dimensions,
    intensity: number
  ): void {
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;
    const maxRadius = Math.sqrt(centerX * centerX + centerY * centerY);
    const startRadius = maxRadius * GRADIENT_CONFIG.vignetteRadius;

    ctx.save();

    const gradient = ctx.createRadialGradient(
      centerX,
      centerY,
      startRadius,
      centerX,
      centerY,
      maxRadius
    );

    gradient.addColorStop(0, `rgba(0, 10, 20, 0)`);
    gradient.addColorStop(0.5, `rgba(0, 8, 18, ${intensity * 0.3})`);
    gradient.addColorStop(1, `rgba(0, 5, 15, ${intensity})`);

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    ctx.restore();
  }

  // ============================================
  // Utility Methods
  // ============================================

  private hsl(h: number, s: number, l: number): string {
    return `hsl(${h}, ${s}%, ${l}%)`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1]!, 16),
          g: parseInt(result[2]!, 16),
          b: parseInt(result[3]!, 16),
        }
      : { r: 100, g: 150, b: 200 };
  }

  private randomInRange(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }

  private randomIntInRange(min: number, max: number): number {
    return min + Math.floor(Math.random() * (max - min + 1));
  }
}
