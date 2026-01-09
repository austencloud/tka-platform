import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type { Ember } from "../domain/models/ember-models";
import { createEmberSystem } from "./EmberSystem";
import { EMBER_BACKGROUND_GRADIENT } from "../domain/constants/ember-constants";

export interface EmberGlowLayers {
  gradient: boolean;
  embers: boolean;
}

export type HeatIntensity = "smolder" | "warm" | "hot" | "blazing";

/**
 * Ember Glow Background System
 *
 * Renders a dark amber background with rising, glowing embers
 * Embers flicker and drift as they rise, creating a warm, cozy atmosphere
 */
export class EmberGlowBackgroundSystem implements IBackgroundSystem {
  private emberSystem: ReturnType<typeof createEmberSystem>;
  private embers: Ember[] = [];
  private quality: QualityLevel = "medium";
  private isInitialized = false;

  // Layer visibility
  private layers: EmberGlowLayers = {
    gradient: true,
    embers: true,
  };

  // Heat intensity
  private heatIntensity: HeatIntensity = "warm";

  // Dark amber gradient colors from constants
  private readonly gradientStops = EMBER_BACKGROUND_GRADIENT;

  constructor() {
    this.emberSystem = createEmberSystem();
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.embers = this.emberSystem.initialize(dimensions, quality);
    this.isInitialized = true;
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (dimensions.width > 0 && dimensions.height > 0) {
      if (!this.isInitialized || this.embers.length === 0) {
        this.initialize(dimensions, this.quality);
      }
    }

    if (this.isInitialized) {
      this.embers = this.emberSystem.update(
        this.embers,
        dimensions,
        frameMultiplier
      );
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    // Draw dark amber gradient background
    if (this.layers.gradient) {
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

    // Draw embers
    if (this.layers.embers && this.isInitialized) {
      this.emberSystem.draw(this.embers, ctx, dimensions);
    }
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
    if (this.isInitialized && this.embers.length > 0) {
      const dimensions = {
        width: this.embers[0]?.x || 1920,
        height: this.embers[0]?.y || 1080,
      };
      this.embers = this.emberSystem.setQuality(
        this.embers,
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
      this.embers = this.emberSystem.adjustToResize(
        this.embers,
        oldDimensions,
        newDimensions,
        this.quality
      );
    }
  }

  public cleanup(): void {
    this.embers = [];
    this.isInitialized = false;
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<EmberGlowLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  /**
   * Get current scene statistics
   */
  public getStats(): { embers: number } {
    return {
      embers: this.embers.length,
    };
  }

  /**
   * Set heat intensity level
   */
  public setHeatIntensity(intensity: HeatIntensity): void {
    this.heatIntensity = intensity;
  }
}
