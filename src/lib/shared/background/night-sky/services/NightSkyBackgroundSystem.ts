import { resolve } from "../../../inversify/di";
import { TYPES } from "../../../inversify/types";
import type { IGeoLocationProvider } from "$lib/shared/device/services/contracts/IGeoLocationProvider";
import type {
  AccessibilitySettings,
  QualitySettings,
} from "../../shared/domain/models/background-models";
import type {
  Dimensions,
  QualityLevel,
} from "../../shared/domain/types/background-types";
import type { IBackgroundConfigurationService } from "../../shared/services/contracts/IBackgroundConfigurationService";
import type { IBackgroundRenderingService } from "../../shared/services/contracts/IBackgroundRenderingService";
import type { IBackgroundSystem } from "../../shared/services/contracts/IBackgroundSystem";
import { createShootingStarSystem } from "../../shared/services/implementations/ShootingStarSystem";
import type { NightSkyConfig } from "../domain/constants/night-sky-constants";
import { CometSystem } from "./CometSystem";
import { ConstellationSystem } from "./ConstellationSystem";
import type { INightSkyCalculationService } from "./contracts/INightSkyCalculationService";
import { MilkyWaySystem } from "./MilkyWaySystem";
import { MoonSystem } from "./MoonSystem";
import { NebulaSystem } from "./NebulaSystem";
import { ProceduralNebulaSystem } from "./ProceduralNebulaSystem";
import { ParallaxStarSystem } from "./ParallaxStarSystem";
import { SpaceshipSystem } from "./SpaceshipSystem";

// TODO: Fix this - ShootingStarState should be imported from proper location
interface ShootingStarState {
  star: {
    x: number;
    y: number;
    dx: number;
    dy: number;
    size: number;
    speed: number;
    tail: Array<{ x: number; y: number; size: number; color: string }>;
    prevX: number;
    prevY: number;
    tailLength: number;
    opacity: number;
    offScreen: boolean;
    color: string;
    twinkle: boolean;
  } | null;
  timer: number;
  interval: number;
}

export class NightSkyBackgroundSystem implements IBackgroundSystem {
  // core state -------------------------------------------------------------
  private quality: QualityLevel = "medium";
  private isInitialized: boolean = false;

  // Services (initialized via factory method)
  private renderingService!: IBackgroundRenderingService;
  private configurationService!: IBackgroundConfigurationService;
  private calculationService!: INightSkyCalculationService;
  private geoLocationProvider!: IGeoLocationProvider;

  // Modular systems (initialized via factory method)
  private parallaxStarSystem!: ParallaxStarSystem;
  private nebulaSystem!: NebulaSystem;
  private proceduralNebulaSystem!: ProceduralNebulaSystem;
  private constellationSystem!: ConstellationSystem;
  private moonSystem!: MoonSystem;
  private spaceshipSystem!: SpaceshipSystem;
  private cometSystem!: CometSystem;
  private milkyWaySystem!: MilkyWaySystem;
  private shootingStarSystem = createShootingStarSystem();
  private shootingStarState!: ShootingStarState;

  // config handles (initialized via factory method) -----------------------
  private cfg!: typeof NightSkyConfig;
  private Q!: QualitySettings;
  private a11y: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 2,
  };

  private constructor() {
    // Services will be injected via async factory method
  }

  static create(): NightSkyBackgroundSystem {
    const instance = new NightSkyBackgroundSystem();

    // Inject services synchronously (container already initialized)
    instance.renderingService = resolve<IBackgroundRenderingService>(
      TYPES.IBackgroundRenderingService
    );
    instance.configurationService = resolve<IBackgroundConfigurationService>(
      TYPES.IBackgroundConfigurationService
    );
    instance.calculationService = resolve<INightSkyCalculationService>(
      TYPES.INightSkyCalculationService
    );
    instance.geoLocationProvider = resolve<IGeoLocationProvider>(
      TYPES.IGeoLocationProvider
    );

    // Set observer latitude from geolocation (sync for now, will be updated async)
    const latitude = instance.geoLocationProvider.getLatitude();
    instance.calculationService.setObserverLatitude(latitude);

    // Attempt to get more accurate location asynchronously
    instance.geoLocationProvider.getLocation().then((location) => {
      instance.calculationService.setObserverLatitude(location.latitude);
    });

    // Initialize configuration after services are injected
    const optimized = instance.getOptimizedConfig(instance.quality);
    instance.cfg = optimized.config.nightSky;
    instance.Q = optimized.qualitySettings;

    // Initialize all modular systems
    instance.parallaxStarSystem = new ParallaxStarSystem(
      instance.cfg.parallax,
      instance.cfg.stars,
      instance.Q,
      instance.calculationService
    );

    instance.nebulaSystem = new NebulaSystem(
      instance.cfg.nebula,
      instance.calculationService
    );

    // Procedural nebula system (2036 vision - noise-based organic clouds)
    instance.proceduralNebulaSystem = new ProceduralNebulaSystem();

    instance.constellationSystem = new ConstellationSystem(
      instance.cfg.constellations,
      instance.calculationService
    );

    instance.moonSystem = new MoonSystem(
      instance.cfg.Moon,
      instance.cfg.background.gradientStops,
      instance.calculationService
    );

    instance.spaceshipSystem = new SpaceshipSystem(
      instance.cfg.spaceship,
      instance.calculationService
    );

    instance.cometSystem = new CometSystem(
      instance.cfg.comet,
      instance.cfg.stars,
      instance.calculationService
    );

    instance.milkyWaySystem = new MilkyWaySystem(
      instance.cfg.milkyWay,
      instance.calculationService
    );

    instance.shootingStarState = instance.shootingStarSystem.initialState;

    return instance;
  }

  // ------------------------------------------------------------------------
  /* INITIALISE */
  public initialize(dim: Dimensions, q: QualityLevel) {
    this.setQuality(q); // Sets this.cfg and this.Q

    // Initialize all modular systems
    this.milkyWaySystem.initialize(dim, this.quality);
    this.parallaxStarSystem.initialize(dim, this.a11y);
    this.nebulaSystem.initialize(dim, this.quality);
    this.proceduralNebulaSystem.initialize(dim, this.quality);
    this.moonSystem.initialize(dim, this.quality, this.a11y);

    this.isInitialized = true;
  }

  /* UPDATE */
  public update(dim: Dimensions, frameMultiplier: number = 1.0) {
    this.milkyWaySystem.update(this.a11y, frameMultiplier);
    this.parallaxStarSystem.update(dim, this.a11y, frameMultiplier);
    this.nebulaSystem.update(this.a11y, frameMultiplier);
    this.proceduralNebulaSystem.update(this.a11y, frameMultiplier);
    this.constellationSystem.update(
      this.parallaxStarSystem.getNearStars(),
      this.quality,
      this.a11y,
      frameMultiplier
    );
    this.moonSystem.update(dim, this.a11y, frameMultiplier);

    if (this.Q.enableShootingStars)
      this.shootingStarState = this.shootingStarSystem.update(
        this.shootingStarState,
        dim
      );

    this.spaceshipSystem.update(dim, this.a11y, this.quality);
    this.cometSystem.update(dim, this.a11y, this.quality);
  }

  /* DRAW */
  public draw(ctx: CanvasRenderingContext2D, dim: Dimensions) {
    this.renderingService.drawGradient(
      ctx,
      dim,
      this.cfg.background.gradientStops
    );

    // Only draw other elements if properly initialized
    if (this.isInitialized) {
      // Draw Milky Way first (deep background layer)
      this.milkyWaySystem.draw(ctx, this.a11y);

      // Draw nebula (background layer) - old geometric system (disabled)
      this.nebulaSystem.draw(ctx, this.a11y);

      // Draw procedural nebula (2036 vision - noise-based organic clouds)
      this.proceduralNebulaSystem.draw(ctx, this.a11y);

      // Draw stars (on top of Milky Way and nebulae)
      this.parallaxStarSystem.draw(ctx, this.a11y);

      // Draw constellations
      this.constellationSystem.draw(ctx, this.a11y);

      // Draw moon
      this.moonSystem.draw(ctx, this.a11y);

      if (this.Q.enableShootingStars)
        this.shootingStarSystem.draw(this.shootingStarState, ctx);

      this.spaceshipSystem.draw(ctx, this.a11y);
      this.cometSystem.draw(ctx, this.a11y);
    }
  }

  /* QUALITY / A11Y */
  public setQuality(q: QualityLevel) {
    if (this.quality === q) return;
    this.quality = q;
    // Re-fetch optimized config when quality changes
    const optimized = this.getOptimizedConfig(q);
    this.cfg = optimized.config.nightSky;
    this.Q = optimized.qualitySettings;

    // Update all systems with new config
    this.parallaxStarSystem = new ParallaxStarSystem(
      this.cfg.parallax,
      this.cfg.stars,
      this.Q,
      this.calculationService
    );
    this.nebulaSystem = new NebulaSystem(
      this.cfg.nebula,
      this.calculationService
    );
    this.proceduralNebulaSystem = new ProceduralNebulaSystem();
    this.constellationSystem = new ConstellationSystem(
      this.cfg.constellations,
      this.calculationService
    );
    this.moonSystem = new MoonSystem(
      this.cfg.Moon,
      this.cfg.background.gradientStops,
      this.calculationService
    );
    this.spaceshipSystem = new SpaceshipSystem(
      this.cfg.spaceship,
      this.calculationService
    );
    this.cometSystem = new CometSystem(
      this.cfg.comet,
      this.cfg.stars,
      this.calculationService
    );
    this.milkyWaySystem = new MilkyWaySystem(
      this.cfg.milkyWay,
      this.calculationService
    );
  }

  public setAccessibility(s: AccessibilitySettings) {
    this.a11y = s;
    // Accessibility settings are passed to systems during update/draw calls
  }

  /**
   * Handle viewport resize by adapting star systems to new dimensions
   */
  public handleResize(_oldDimensions: Dimensions, newDimensions: Dimensions) {
    if (this.isInitialized) {
      // Handle Milky Way resize
      this.milkyWaySystem.handleResize(newDimensions);
      // Handle procedural nebula resize
      this.proceduralNebulaSystem.handleResize(newDimensions);
      // The ParallaxStarSystem will automatically handle dimension changes in its update method
      // by calling adaptToNewDimensions when it detects dimension changes
      this.update(newDimensions);
    }
  }

  /* CLEANUP */
  public cleanup() {
    this.isInitialized = false;
    this.milkyWaySystem.cleanup();
    this.parallaxStarSystem.cleanup();
    this.nebulaSystem.cleanup();
    this.proceduralNebulaSystem.cleanup();
    this.constellationSystem.cleanup();
    this.moonSystem.cleanup();
    this.spaceshipSystem.cleanup();
    this.cometSystem.cleanup();
  }

  // Helper methods
  private getOptimizedConfig(quality: QualityLevel) {
    return this.configurationService.getOptimizedConfig(quality);
  }
}
