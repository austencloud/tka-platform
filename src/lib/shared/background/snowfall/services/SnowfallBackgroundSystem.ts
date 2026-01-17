import { container } from "$lib/shared/di";
import type {
  Dimensions,
  QualityLevel,
} from "$lib/shared/background/shared/domain/types/background-types";
import type { IBackgroundConfigurationService } from "$lib/shared/background/shared/services/contracts/IBackgroundConfigurationService";
import type { IBackgroundRenderingService } from "$lib/shared/background/shared/services/contracts/IBackgroundRenderingService";
import type { IBackgroundSystem } from "$lib/shared/background/shared/services/contracts/IBackgroundSystem";
import { createShootingStarSystem } from "$lib/shared/background/shared/services/implementations/ShootingStarSystem";
import type {
  ShootingStarState,
  Snowflake,
} from "../domain/models/snowfall-models";
import { createSnowflakeSystem } from "./SnowflakeSystem";
import type { GradientStop } from "$lib/shared/background/shared/domain/models/background-models";

export interface SnowfallLayers {
  gradient: boolean;
  snowflakes: boolean;
  shootingStars: boolean;
}

export class SnowfallBackgroundSystem implements IBackgroundSystem {
  private snowflakeSystem: ReturnType<typeof createSnowflakeSystem>;
  private shootingStarSystem = createShootingStarSystem();

  // Services
  private renderingService: IBackgroundRenderingService;
  private configurationService: IBackgroundConfigurationService;

  private snowflakes: Snowflake[] = [];
  private shootingStarState: ShootingStarState;

  private quality: QualityLevel = "medium";
  private isInitialized: boolean = false;
  // Track if we initialized with valid dimensions (to detect the 0x0 init bug)
  private initializedWithValidDimensions = false;

  // Layer visibility
  private layers: SnowfallLayers = {
    gradient: true,
    snowflakes: true,
    shootingStars: true,
  };
  constructor() {
    this.snowflakeSystem = createSnowflakeSystem();
    // Inject services
    this.renderingService = container.items.backgroundRenderingService;
    this.configurationService = container.items.backgroundConfigurationService;

    this.shootingStarState = this.shootingStarSystem.initialState;
    this.isInitialized = false;
  }

  public initialize(dimensions: Dimensions, quality: QualityLevel): void {
    this.quality = quality;
    this.snowflakes = this.snowflakeSystem.initialize(dimensions, quality);

    this.shootingStarState = this.shootingStarSystem.initialState;
    this.isInitialized = true;
    // Track whether we got real dimensions (canvas may not be laid out yet)
    this.initializedWithValidDimensions = dimensions.width > 0 && dimensions.height > 0;

    // Pre-populate: Simulate animation already running
    // Distribute snowflakes across the entire viewport height
    this.snowflakes.forEach((snowflake) => {
      // Random Y position from 0 to full height (instead of starting at top)
      snowflake.y = Math.random() * dimensions.height;
      // Random progress through sway animation
      snowflake.x += Math.sin(Math.random() * Math.PI * 2) * snowflake.sway;
    });
  }

  public update(dimensions: Dimensions, frameMultiplier: number = 1.0): void {
    if (dimensions.width > 0 && dimensions.height > 0) {
      // Re-initialize if: not initialized, no snowflakes, OR we initially got 0x0 dimensions
      // The 0x0 case happens when canvas isn't laid out yet - all particles spawn at (0,0)
      if (!this.isInitialized || this.snowflakes.length === 0 || !this.initializedWithValidDimensions) {
        this.initialize(dimensions, this.quality);
      }
    }

    if (this.isInitialized) {
      this.snowflakes = this.snowflakeSystem.update(
        this.snowflakes,
        dimensions,
        frameMultiplier
      );
      const { qualitySettings } = this.configurationService.getOptimizedConfig(
        this.quality
      );
      if (qualitySettings.enableShootingStars) {
        this.shootingStarState = this.shootingStarSystem.update(
          this.shootingStarState,
          dimensions,
          frameMultiplier
        );
      }
    }
  }

  public draw(ctx: CanvasRenderingContext2D, dimensions: Dimensions): void {
    const { config, qualitySettings } =
      this.configurationService.getOptimizedConfig(this.quality);

    if (this.layers.gradient) {
      const gradientStops = [
        ...config.core.background.gradientStops,
      ] as GradientStop[];
      this.renderingService.drawGradient(ctx, dimensions, gradientStops);
    }

    if (this.isInitialized) {
      if (this.layers.snowflakes) {
        this.snowflakeSystem.draw(this.snowflakes, ctx, dimensions);
      }
      if (this.layers.shootingStars && qualitySettings.enableShootingStars) {
        this.shootingStarSystem.draw(this.shootingStarState, ctx);
      }
    }
  }

  public setQuality(quality: QualityLevel): void {
    this.quality = quality;
    this.snowflakeSystem.setQuality(quality);
  }

  public setAccessibility(_settings: {
    reducedMotion: boolean;
    highContrast: boolean;
  }): void {
    // Accessibility settings would be used for motion reduction, etc.
  }

  public handleResize(
    oldDimensions: Dimensions,
    newDimensions: Dimensions
  ): void {
    this.snowflakes = this.snowflakeSystem.adjustToResize(
      this.snowflakes,
      oldDimensions,
      newDimensions,
      this.quality
    );

    this.shootingStarState = this.shootingStarSystem.initialState;
  }

  public cleanup(): void {
    this.snowflakes = [];
    this.isInitialized = false;
    this.initializedWithValidDimensions = false;
  }

  /**
   * Set layer visibility
   */
  public setLayerVisibility(layers: Partial<SnowfallLayers>): void {
    this.layers = { ...this.layers, ...layers };
  }

  /**
   * Get current scene statistics
   */
  public getStats(): { snowflakes: number } {
    return {
      snowflakes: this.snowflakes.length,
    };
  }
}
