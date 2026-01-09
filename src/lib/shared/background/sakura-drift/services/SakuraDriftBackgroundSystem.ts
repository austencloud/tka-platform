import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type { SakuraPetal } from "../domain/models/sakura-models";
import { createSakuraSystem } from "./SakuraSystem";
import { createSakuraWindSystem, type SakuraWindSystem } from "./SakuraWindSystem";
import {
  type TimeOfDay,
  type TimeOfDayPreset,
  type GradientStop,
  getTimeOfDayPreset,
  TWILIGHT_PRESET,
} from "../domain/constants/time-of-day-presets";

/**
 * Cherry Blossom Background System
 *
 * Renders cherry blossom petals with three time-of-day modes:
 * - Twilight: Soft purple-lavender (peaceful, contemplative)
 * - Golden Hour: Warm orange-pink-gold (nostalgic, warm)
 * - Night: Deep blue-purple with lanterns (magical, festival)
 *
 * All layers are toggleable for experimentation.
 */
export interface CherryBlossomLayers {
  // Core
  gradient: boolean;
  petals: boolean;

  // Parallax depth layers (when petals=true)
  petalsFar: boolean;
  petalsMid: boolean;
  petalsNear: boolean;

  // Effects
  trails: boolean;
  accumulation: boolean;
  vortex: boolean;

  // Environmental
  moon: boolean;
  stars: boolean;
  lightRays: boolean;
  trees: boolean;
  lanterns: boolean;
  reflection: boolean;
}

// Alias for backwards compatibility
export type SakuraDriftLayers = CherryBlossomLayers;

export class SakuraDriftBackgroundSystem implements IBackgroundSystem {
  private sakuraSystem: ReturnType<typeof createSakuraSystem>;
  private windSystem: SakuraWindSystem;
  private petals: SakuraPetal[] = [];
  private quality: QualityLevel = "medium";
  private isInitialized = false;

  // Time of day preset
  private currentPreset: TimeOfDayPreset = TWILIGHT_PRESET;
  private gradientStops: GradientStop[] = TWILIGHT_PRESET.gradient;

  // Layer visibility - expanded for all features
  private layers: CherryBlossomLayers = {
    gradient: true,
    petals: true,
    petalsFar: true,
    petalsMid: true,
    petalsNear: true,
    trails: false,
    accumulation: false,
    vortex: false,
    moon: false,
    stars: false,
    lightRays: false,
    trees: false,
    lanterns: false,
    reflection: false,
  };

  constructor() {
    this.sakuraSystem = createSakuraSystem();
    this.windSystem = createSakuraWindSystem();
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.petals = this.sakuraSystem.initialize(dimensions, quality);
    this.windSystem.initialize();
    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (!this.isInitialized || this.petals.length === 0) {
        this.initialize(dimensions, this.quality);
      }
    }

    if (this.isInitialized) {
      // Update wind system first
      this.windSystem.update(frameMultiplier);
      const windForce = this.windSystem.getWindForce();

      // Update petals with wind force
      this.petals = this.sakuraSystem.update(
        this.petals,
        dimensions,
        frameMultiplier,
        windForce
      );
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Layer 1: Background gradient
    if (this.layers.gradient) {
      this.drawGradient(ctx, dimensions);
    }

    // Layer 2: Stars (night mode only)
    if (this.layers.stars) {
      // TODO: Integrate CherryStarSystem
    }

    // Layer 3: Moon (night mode only)
    if (this.layers.moon) {
      // TODO: Integrate CherryMoonSystem
    }

    // Layer 4: Light rays (golden hour only)
    if (this.layers.lightRays) {
      // TODO: Integrate CanopyLightRaySystem
    }

    // Layer 5: Trees (back layer silhouettes)
    if (this.layers.trees) {
      // TODO: Integrate TreeSilhouetteSystem (back layer)
    }

    // Layer 6-8: Parallax petals (far, mid, near)
    if (this.layers.petals && this.isInitialized) {
      // For now, draw all petals together
      // TODO: Separate into parallax depth layers
      this.sakuraSystem.draw(this.petals, ctx, dimensions);
    }

    // Layer 9: Petal trails
    if (this.layers.trails) {
      // TODO: Integrate PetalTrailSystem
    }

    // Layer 10: Vortex effects
    if (this.layers.vortex) {
      // TODO: Integrate VortexSystem
    }

    // Layer 11: Water reflection
    if (this.layers.reflection) {
      // TODO: Integrate WaterReflectionSystem
    }

    // Layer 12: Ground accumulation
    if (this.layers.accumulation) {
      // TODO: Integrate GroundAccumulationSystem
    }

    // Layer 13: Lanterns (foreground glow)
    if (this.layers.lanterns) {
      // TODO: Integrate LanternSystem
    }
  }

  private drawGradient(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const gradient = ctx.createLinearGradient(
      0,
      0,
      dimensions.width,
      dimensions.height
    );
    this.gradientStops.forEach(({ position, color }) => {
      gradient.addColorStop(position, color);
    });

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
    if (this.isInitialized && this.petals.length > 0) {
      const dimensions = {
        width: this.petals[0]?.x || 1920,
        height: this.petals[0]?.y || 1080,
      };
      this.petals = this.sakuraSystem.setQuality(
        this.petals,
        dimensions,
        quality
      );
    }
  }

  public setAccessibility(_settings: {
    reducedMotion: boolean;
    highContrast: boolean;
  }): void {
    // Could implement motion reduction or contrast adjustments
  }

  public handleResize(
    oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    if (this.isInitialized) {
      this.petals = this.sakuraSystem.adjustToResize(
        this.petals,
        oldDimensions,
        newDimensions,
        this.quality
      );
    }
  }

  public cleanup(): void {
    this.petals = [];
    this.isInitialized = false;
  }

  /**
   * Set the time of day mode
   * Updates gradient and auto-enables appropriate layers
   */
  public setTimeOfDay(mode: TimeOfDay): void {
    this.currentPreset = getTimeOfDayPreset(mode);
    this.gradientStops = this.currentPreset.gradient;

    // Apply default layers for this mode
    this.layers = {
      ...this.layers,
      ...this.currentPreset.defaultLayers,
    };
  }

  /**
   * Get current time of day mode
   */
  public getTimeOfDay(): TimeOfDay {
    return this.currentPreset.id;
  }

  /**
   * Get current preset (for UI theming)
   */
  public getCurrentPreset(): TimeOfDayPreset {
    return this.currentPreset;
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<CherryBlossomLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  /**
   * Get current layer visibility
   */
  public getLayerVisibility(): CherryBlossomLayers {
    return { ...this.layers };
  }

  /**
   * Get current scene statistics
   */
  public getStats(): { petals: number; flowers: number } {
    const flowers = this.petals.filter((p) => p.isFlower).length;
    return {
      petals: this.petals.length - flowers,
      flowers,
    };
  }

  /**
   * Trigger a wind gust manually
   */
  public triggerGust(direction?: number): void {
    this.windSystem.triggerGust(direction);
  }
}
