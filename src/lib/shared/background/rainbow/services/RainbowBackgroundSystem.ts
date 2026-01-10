import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { AccessibilitySettings } from "$lib/shared/background/shared/domain/models/background-models";
import type { RainbowLayers, RainbowStats } from "../domain/models/rainbow-models";
import {
  PRIDE_PALETTES,
  RAINBOW_QUALITY_CONFIGS,
  RAINBOW_BASE_GRADIENT,
  getDarkenedPalette,
  type PridePalette,
} from "../domain/constants/rainbow-constants";
import { RainbowGradientSystem } from "./RainbowGradientSystem";
import { RainbowBokehSystem } from "./RainbowBokehSystem";
import { RainbowSparkleSystem } from "./RainbowSparkleSystem";
import { RainbowShimmerSystem } from "./RainbowShimmerSystem";
import { PrideHeartsSystem } from "./PrideHeartsSystem";

/**
 * RainbowBackgroundSystem - Pride celebration background
 *
 * A sophisticated background system celebrating LGBTQ+ pride with
 * flowing rainbow bands, sparkles, bokeh orbs, shimmer effects,
 * and optional floating hearts.
 *
 * Architecture: Composition pattern with dedicated subsystems for each visual layer.
 */
export class RainbowBackgroundSystem implements IBackgroundSystem {
  // Subsystems
  private gradientSystem: RainbowGradientSystem;
  private bokehSystem: RainbowBokehSystem;
  private sparkleSystem: RainbowSparkleSystem;
  private shimmerSystem: RainbowShimmerSystem;
  private heartsSystem: PrideHeartsSystem;

  // State
  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private dimensions: Dimensions = { width: 0, height: 0 };
  private accessibility: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
  };

  // Palette
  private currentPalette: PridePalette = "classic";
  private colors: string[] = [];
  private brightColors: string[] = [];

  // Layer visibility for lab mode
  private layerVisibility: RainbowLayers = {
    gradient: true,
    bands: true,
    shimmer: true,
    bokeh: true,
    sparkles: true,
    hearts: true,
  };

  constructor() {
    this.gradientSystem = new RainbowGradientSystem();
    this.bokehSystem = new RainbowBokehSystem();
    this.sparkleSystem = new RainbowSparkleSystem();
    this.shimmerSystem = new RainbowShimmerSystem();
    this.heartsSystem = new PrideHeartsSystem();

    // Initialize colors
    this.updatePaletteColors();
  }

  /**
   * Initialize the background system
   */
  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.dimensions = dimensions;
    this.quality = quality;

    const config = RAINBOW_QUALITY_CONFIGS[quality];

    // Initialize each subsystem
    this.gradientSystem.initialize(this.colors, this.brightColors, config.bandCount);
    this.bokehSystem.initialize(this.colors, config.bokehCount);
    this.sparkleSystem.initialize(config.sparkleCount, this.colors);

    if (config.shimmerEnabled) {
      this.shimmerSystem.initialize(config.shimmerPoints);
    }

    if (config.heartCount > 0) {
      this.heartsSystem.initialize(this.brightColors, config.heartCount);
    }

    this.isInitialized = true;
  }

  /**
   * Update animation state
   */
  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (!this.isInitialized) return;

    this.dimensions = dimensions;
    const config = RAINBOW_QUALITY_CONFIGS[this.quality];

    // Update subsystems
    this.gradientSystem.update(this.accessibility, frameMultiplier);
    this.bokehSystem.update(this.accessibility, frameMultiplier);
    this.sparkleSystem.update(this.accessibility, frameMultiplier);

    if (config.shimmerEnabled) {
      this.shimmerSystem.update(this.accessibility, frameMultiplier);
    }

    if (config.heartCount > 0) {
      this.heartsSystem.update(this.accessibility, frameMultiplier, this.brightColors);
    }
  }

  /**
   * Draw all layers
   */
  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    if (!this.isInitialized) return;

    const config = RAINBOW_QUALITY_CONFIGS[this.quality];

    // Layer 1: Base gradient (always drawn as foundation)
    if (this.layerVisibility.gradient) {
      this.drawBaseGradient(ctx, dimensions);
    } else {
      // Fill with darkest color as fallback
      const baseColor = RAINBOW_BASE_GRADIENT[0]?.color || "#0a0a15";
      ctx.fillStyle = baseColor;
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    // Layer 2: Wave bands
    if (this.layerVisibility.bands) {
      this.gradientSystem.draw(ctx, dimensions);
    }

    // Layer 3: Shimmer effects (behind particles)
    if (this.layerVisibility.shimmer && config.shimmerEnabled) {
      this.shimmerSystem.draw(ctx, dimensions);
    }

    // Layer 4: Bokeh orbs
    if (this.layerVisibility.bokeh) {
      this.bokehSystem.draw(ctx, dimensions);
    }

    // Layer 5: Sparkles
    if (this.layerVisibility.sparkles) {
      this.sparkleSystem.draw(ctx, dimensions);
    }

    // Layer 6: Hearts (high quality only)
    if (this.layerVisibility.hearts && config.heartCount > 0) {
      this.heartsSystem.draw(ctx, dimensions);
    }
  }

  /**
   * Draw the base dark gradient
   */
  private drawBaseGradient(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const gradient = ctx.createLinearGradient(0, 0, 0, dimensions.height);

    for (const stop of RAINBOW_BASE_GRADIENT) {
      gradient.addColorStop(stop.position, stop.color);
    }

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  /**
   * Set quality level
   */
  public setQuality(quality: QualityLevel): void {
    if (this.quality === quality) return;

    this.quality = quality;

    if (this.isInitialized) {
      // Reinitialize with new quality
      this.initialize(this.dimensions, quality);
    }
  }

  /**
   * Set accessibility settings
   */
  public setAccessibility(settings: AccessibilitySettings): void {
    this.accessibility = settings;
  }

  /**
   * Handle resize
   */
  public handleResize(oldDimensions: Dimensions, newDimensions: Dimensions): void {
    if (!this.isInitialized) return;

    // Reinitialize with new dimensions
    this.initialize(newDimensions, this.quality);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    this.gradientSystem.cleanup();
    this.bokehSystem.cleanup();
    this.sparkleSystem.cleanup();
    this.shimmerSystem.cleanup();
    this.heartsSystem.cleanup();
    this.isInitialized = false;
  }

  // --- Lab Mode Methods ---

  /**
   * Set the pride palette
   */
  public setPalette(palette: PridePalette): void {
    if (this.currentPalette === palette) return;

    this.currentPalette = palette;
    this.updatePaletteColors();

    // Update subsystems with new colors
    if (this.isInitialized) {
      this.gradientSystem.updateColors(this.colors, this.brightColors);
      this.bokehSystem.updateColors(this.colors);
      this.heartsSystem.updateColors(this.brightColors);
    }
  }

  /**
   * Get current palette
   */
  public getPalette(): PridePalette {
    return this.currentPalette;
  }

  /**
   * Update colors from current palette
   */
  private updatePaletteColors(): void {
    this.brightColors = [...PRIDE_PALETTES[this.currentPalette]];
    this.colors = getDarkenedPalette(this.currentPalette);
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<RainbowLayers>): void {
    this.layerVisibility = { ...this.layerVisibility, ...layers };
  }

  /**
   * Get layer visibility
   */
  public getLayerVisibility(): RainbowLayers {
    return { ...this.layerVisibility };
  }

  /**
   * Get stats for lab display
   */
  public getStats(): RainbowStats {
    return {
      bands: this.gradientSystem.getBands().length,
      bokeh: this.bokehSystem.getOrbs().length,
      sparkles: this.sparkleSystem.getSparkles().length,
      hearts: this.heartsSystem.getHearts().length,
      shimmerPoints: this.shimmerSystem.getShimmerPoints().length,
      palette: this.currentPalette,
    };
  }

  /**
   * Get available palettes
   */
  public getAvailablePalettes(): PridePalette[] {
    return Object.keys(PRIDE_PALETTES) as PridePalette[];
  }
}
