import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import type { SakuraPetal } from "../domain/models/sakura-models";
import { createSakuraSystem } from "./SakuraSystem";
import { createSakuraWindSystem, type SakuraWindSystem } from "./SakuraWindSystem";
import { SAKURA_BACKGROUND_GRADIENT } from "../domain/constants/sakura-constants";

/**
 * Sakura Drift Background System
 *
 * Renders a soft twilight background with gently falling cherry blossom petals
 * Petals respond to gentle wind gusts for natural, organic movement
 */
export class SakuraDriftBackgroundSystem implements IBackgroundSystem {
  private sakuraSystem: ReturnType<typeof createSakuraSystem>;
  private windSystem: SakuraWindSystem;
  private petals: SakuraPetal[] = [];
  private quality: QualityLevel = "medium";
  private isInitialized = false;

  // Soft twilight gradient colors from constants
  private readonly gradientStops = SAKURA_BACKGROUND_GRADIENT;

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
    // Draw soft twilight gradient background
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

    // Draw petals
    if (this.isInitialized) {
      this.sakuraSystem.draw(this.petals, ctx, dimensions);
    }
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
}
