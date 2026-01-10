import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type { CherryPetal } from "../domain/models/cherry-blossom-models";
import { createCherryBlossomPetalSystem } from "./CherryBlossomPetalSystem";
import { createCherryBlossomWindSystem, type CherryBlossomWindSystem } from "./CherryBlossomWindSystem";
import {
  type TimeOfDay,
  type TimeOfDayPreset,
  type GradientStop,
  getTimeOfDayPreset,
  TWILIGHT_PRESET,
} from "../domain/constants/time-of-day-presets";

// Environmental systems
import { MoonRenderer, createFullMoon, type MoonConfig } from "$lib/shared/background/shared/services/MoonRenderer";
import { CherryStarSystem } from "./environment/CherryStarSystem";
import { TreeSilhouetteSystem } from "./environment/TreeSilhouetteSystem";
import { LanternSystem } from "./environment/LanternSystem";

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
  trees: boolean;
  lanterns: boolean;
  reflection: boolean;
}

export class CherryBlossomBackgroundSystem implements IBackgroundSystem {
  private petalSystem: ReturnType<typeof createCherryBlossomPetalSystem>;
  private windSystem: CherryBlossomWindSystem;
  private petals: CherryPetal[] = [];
  private quality: QualityLevel = "medium";
  private isInitialized = false;
  private lastDimensions: Dimensions | null = null;

  // Time of day preset
  private currentPreset: TimeOfDayPreset = TWILIGHT_PRESET;
  private gradientStops: GradientStop[] = TWILIGHT_PRESET.gradient;

  // Environmental systems
  private moonSystem: MoonRenderer;
  private starSystem: CherryStarSystem;
  private treeSystem: TreeSilhouetteSystem;
  private lanternSystem: LanternSystem;

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
    trees: false,
    lanterns: false,
    reflection: false,
  };

  constructor() {
    this.petalSystem = createCherryBlossomPetalSystem();
    this.windSystem = createCherryBlossomWindSystem();

    // Initialize environmental systems
    this.moonSystem = createFullMoon({
      x: 0.82,
      y: 0.15,
      radiusFraction: 0.06,
      colorTemp: "warm",
      animated: true,
    });
    this.starSystem = new CherryStarSystem(this.quality);
    this.treeSystem = new TreeSilhouetteSystem();
    this.lanternSystem = new LanternSystem(this.quality);
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.lastDimensions = dimensions;
    this.petals = this.petalSystem.initialize(dimensions, quality);
    this.windSystem.initialize();

    // Initialize environmental systems
    this.moonSystem.initialize(dimensions.width, dimensions.height);
    this.starSystem.initialize(dimensions);
    this.treeSystem.initialize(dimensions);
    this.lanternSystem.initialize(dimensions);

    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (!this.isInitialized || this.petals.length === 0) {
        this.initialize(dimensions, this.quality);
      }
      this.lastDimensions = dimensions;
    }

    if (this.isInitialized) {
      // Update wind system first
      this.windSystem.update(frameMultiplier);
      const windForce = this.windSystem.getWindForce();

      // Update petals with wind force
      this.petals = this.petalSystem.update(
        this.petals,
        dimensions,
        frameMultiplier,
        windForce
      );

      // Update environmental systems
      if (this.layers.moon) {
        this.moonSystem.update(frameMultiplier);
      }
      if (this.layers.stars) {
        this.starSystem.update(dimensions, frameMultiplier);
      }
      if (this.layers.trees) {
        this.treeSystem.update(dimensions, frameMultiplier);
      }
      if (this.layers.lanterns) {
        this.lanternSystem.update(dimensions, frameMultiplier);
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Layer 1: Background gradient
    if (this.layers.gradient) {
      this.drawGradient(ctx, dimensions);
    }

    // Layer 2: Stars (night mode only)
    if (this.layers.stars) {
      this.starSystem.draw(ctx);
    }

    // Layer 3: Moon (night mode only)
    if (this.layers.moon) {
      this.moonSystem.draw(ctx);
    }

    // Layer 4: Trees (back layer silhouettes)
    if (this.layers.trees) {
      this.treeSystem.draw(ctx, dimensions);
    }

    // Layer 6-8: Parallax petals (far, mid, near)
    if (this.layers.petals && this.isInitialized) {
      // Draw petals with parallax depth layering
      this.petalSystem.draw(this.petals, ctx, dimensions, {
        petalsFar: this.layers.petalsFar,
        petalsMid: this.layers.petalsMid,
        petalsNear: this.layers.petalsNear,
      });
    }

    // Layer 9: Petal trails (future implementation)
    if (this.layers.trails) {
      // PetalTrailSystem - to be implemented
    }

    // Layer 10: Vortex effects (future implementation)
    if (this.layers.vortex) {
      // VortexSystem - to be implemented
    }

    // Layer 11: Water reflection (future implementation)
    if (this.layers.reflection) {
      // WaterReflectionSystem - to be implemented
    }

    // Layer 12: Ground accumulation (future implementation)
    if (this.layers.accumulation) {
      // GroundAccumulationSystem - to be implemented
    }

    // Layer 13: Lanterns (foreground glow)
    if (this.layers.lanterns) {
      this.lanternSystem.draw(ctx, dimensions);
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
    const dimensions = this.lastDimensions || { width: 1920, height: 1080 };

    if (this.isInitialized && this.petals.length > 0) {
      this.petals = this.petalSystem.setQuality(
        this.petals,
        dimensions,
        quality
      );
    }

    // Update quality for environmental systems
    this.starSystem.setQuality(quality, dimensions);
    this.lanternSystem.setQuality(quality, dimensions);
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
      this.lastDimensions = newDimensions;
      this.petals = this.petalSystem.adjustToResize(
        this.petals,
        oldDimensions,
        newDimensions,
        this.quality
      );

      // Handle resize for environmental systems
      this.moonSystem.resize(newDimensions.width, newDimensions.height);
      this.starSystem.handleResize(oldDimensions, newDimensions);
      this.treeSystem.handleResize(newDimensions);
      this.lanternSystem.handleResize(oldDimensions, newDimensions);
    }
  }

  public cleanup(): void {
    this.petals = [];
    this.isInitialized = false;
    this.lastDimensions = null;

    // Cleanup environmental systems
    this.moonSystem.cleanup();
    this.starSystem.cleanup();
    this.treeSystem.cleanup();
    this.lanternSystem.cleanup();
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
  public getStats(): {
    petals: number;
    flowers: number;
    lanterns: number;
    stars: number;
  } {
    const flowers = this.petals.filter((p) => p.isFlower).length;
    return {
      petals: this.petals.length - flowers,
      flowers,
      lanterns: this.layers.lanterns ? 8 : 0, // Approximate based on quality
      stars: this.layers.stars ? 100 : 0, // Approximate
    };
  }

  /**
   * Trigger a wind gust manually
   */
  public triggerGust(direction?: number): void {
    this.windSystem.triggerGust(direction);
  }

  /**
   * Get current moon configuration
   */
  public getMoonConfig(): Partial<MoonConfig> {
    return this.moonSystem.getConfig();
  }

  /**
   * Update moon configuration
   */
  public setMoonConfig(config: Partial<MoonConfig>): void {
    this.moonSystem.setConfig(config);
  }
}
