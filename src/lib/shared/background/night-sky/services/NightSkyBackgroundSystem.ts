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
import { MilkyWayParticleSystem } from "./MilkyWayParticleSystem";
import { NebulaSystem } from "./NebulaSystem";
import { ProceduralNebulaSystem } from "./ProceduralNebulaSystem";
import { ParallaxStarSystem } from "./ParallaxStarSystem";
import { AuroraSystem } from "./AuroraSystem";
import { UFOSystem } from "./UFOSystem";

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
  private lastDimensions: Dimensions = { width: 1920, height: 1080 };

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
  private ufoSystem!: UFOSystem;
  private cometSystem!: CometSystem;
  private milkyWaySystem!: MilkyWaySystem;
  private milkyWayParticleSystem!: MilkyWayParticleSystem;
  private auroraSystem!: AuroraSystem;
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

    instance.ufoSystem = new UFOSystem(
      instance.cfg.ufo,
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

    // New particle-based Milky Way (2036 vision)
    instance.milkyWayParticleSystem = new MilkyWayParticleSystem();

    // Aurora system (2036 vision - flowing curtains of light)
    instance.auroraSystem = new AuroraSystem();

    instance.shootingStarState = instance.shootingStarSystem.initialState;

    // Wire up UFO's intelligent beam targeting
    instance.ufoSystem.setStarProvider(() => {
      // Get bright stars from near and mid layers for scanning targets
      const brightStars = instance.parallaxStarSystem.getAllBrightStars();
      return brightStars.map((star) => ({
        x: star.x,
        y: star.y,
        brightness: star.currentOpacity ?? 0.8,
      }));
    });

    instance.ufoSystem.setEventProvider(() => {
      // Check for active meteor
      if (instance.shootingStarState.star && !instance.shootingStarState.star.offScreen) {
        return {
          x: instance.shootingStarState.star.x,
          y: instance.shootingStarState.star.y,
          active: true,
        };
      }
      // Check for active comet
      if (instance.cometSystem.isActive()) {
        const cometPos = instance.cometSystem.getPosition?.();
        if (cometPos) {
          return { x: cometPos.x, y: cometPos.y, active: true };
        }
      }
      return null;
    });

    return instance;
  }

  // ------------------------------------------------------------------------
  /* INITIALISE */
  public initialize(dim: Dimensions, q: QualityLevel) {
    this.setQuality(q); // Sets this.cfg and this.Q

    // Initialize all modular systems
    this.milkyWaySystem.initialize(dim, this.quality);
    this.milkyWayParticleSystem.initialize(dim, this.quality);
    this.parallaxStarSystem.initialize(dim, this.a11y);
    this.nebulaSystem.initialize(dim, this.quality);
    this.proceduralNebulaSystem.initialize(dim, this.quality);
    this.auroraSystem.initialize(dim, this.quality);

    this.isInitialized = true;
  }

  /* UPDATE */
  public update(dim: Dimensions, frameMultiplier: number = 1.0) {
    this.lastDimensions = dim;
    this.milkyWaySystem.update(this.a11y, frameMultiplier);
    this.milkyWayParticleSystem.update(this.a11y, frameMultiplier);
    this.parallaxStarSystem.update(dim, this.a11y, frameMultiplier);
    this.nebulaSystem.update(this.a11y, frameMultiplier);
    this.proceduralNebulaSystem.update(this.a11y, frameMultiplier);
    this.auroraSystem.update(this.a11y, frameMultiplier);
    this.constellationSystem.update(
      this.parallaxStarSystem.getNearStars(),
      this.quality,
      this.a11y,
      frameMultiplier
    );

    // Update meteors (shooting stars)
    if (this.layerVisibility.meteors && this.Q.enableShootingStars) {
      this.shootingStarState = this.shootingStarSystem.update(
        this.shootingStarState,
        dim
      );
    }

    // Update UFO (Easter egg)
    if (this.layerVisibility.ufo) {
      this.ufoSystem.update(dim, this.a11y, this.quality);
    }

    // Update comets
    if (this.layerVisibility.comets) {
      this.cometSystem.update(dim, this.a11y, this.quality);
    }
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
      if (this.layerVisibility.milkyWay) {
        this.milkyWayParticleSystem.draw(ctx, this.a11y);
      }

      // Draw nebula (background layer)
      if (this.layerVisibility.nebula) {
        // Old geometric system (disabled): this.nebulaSystem.draw(ctx, this.a11y);
        // New procedural nebula (2036 vision):
        this.proceduralNebulaSystem.draw(ctx, this.a11y);
      }

      // Draw aurora (2036 vision - flowing curtains of light)
      // Note: aurora visibility controlled via setActive method
      this.auroraSystem.draw(ctx, this.a11y);

      // Draw stars (on top of Milky Way, nebulae, and aurora)
      if (this.layerVisibility.stars) {
        this.parallaxStarSystem.draw(ctx, this.a11y);
      }

      // Draw constellations (disabled)
      // this.constellationSystem.draw(ctx, this.a11y);

      // Draw meteors (shooting stars)
      if (this.layerVisibility.meteors && this.Q.enableShootingStars) {
        this.shootingStarSystem.draw(this.shootingStarState, ctx);
      }

      // Draw UFO (Easter egg - on top of most elements)
      if (this.layerVisibility.ufo) {
        this.ufoSystem.draw(ctx, this.a11y);
      }

      // Draw comets
      if (this.layerVisibility.comets) {
        this.cometSystem.draw(ctx, this.a11y);
      }
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
    this.ufoSystem = new UFOSystem(
      this.cfg.ufo,
      this.calculationService
    );
    // Re-wire UFO providers after recreation
    this.ufoSystem.setStarProvider(() => {
      const brightStars = this.parallaxStarSystem.getAllBrightStars();
      return brightStars.map((star) => ({
        x: star.x,
        y: star.y,
        brightness: star.currentOpacity ?? 0.8,
      }));
    });
    this.ufoSystem.setEventProvider(() => {
      if (this.shootingStarState.star && !this.shootingStarState.star.offScreen) {
        return {
          x: this.shootingStarState.star.x,
          y: this.shootingStarState.star.y,
          active: true,
        };
      }
      if (this.cometSystem.isActive()) {
        const cometPos = this.cometSystem.getPosition?.();
        if (cometPos) {
          return { x: cometPos.x, y: cometPos.y, active: true };
        }
      }
      return null;
    });
    this.cometSystem = new CometSystem(
      this.cfg.comet,
      this.cfg.stars,
      this.calculationService
    );
    this.milkyWaySystem = new MilkyWaySystem(
      this.cfg.milkyWay,
      this.calculationService
    );
    this.milkyWayParticleSystem = new MilkyWayParticleSystem();
    this.auroraSystem = new AuroraSystem();
  }

  public setAccessibility(s: AccessibilitySettings) {
    this.a11y = s;
    // Accessibility settings are passed to systems during update/draw calls
  }

  /**
   * Control visibility of individual layers (for Night Sky Lab)
   */
  public setLayerVisibility(layers: {
    stars?: boolean;
    nebula?: boolean;
    aurora?: boolean;
    milkyWay?: boolean;
    meteors?: boolean;
    comets?: boolean;
    ufo?: boolean;
  }) {
    if (layers.aurora !== undefined) {
      this.auroraSystem.setActive(layers.aurora);
    }
    // Store visibility state for layers without setActive methods
    this.layerVisibility = { ...this.layerVisibility, ...layers };
  }

  /**
   * Manually trigger a meteor (shooting star) to appear
   */
  public triggerMeteor(): void {
    if (!this.layerVisibility.meteors) return;

    // Force spawn a shooting star by resetting state with a new star
    const newStar = this.shootingStarSystem.update(
      { star: null, timer: 999999, interval: 0 },
      this.lastDimensions
    );
    this.shootingStarState = newStar;
  }

  /**
   * Manually trigger a comet to appear
   */
  public triggerComet(): void {
    if (!this.layerVisibility.comets) return;
    this.cometSystem.trigger(this.lastDimensions);
  }

  /**
   * Check if a comet is currently visible
   */
  public isCometActive(): boolean {
    return this.cometSystem.isActive();
  }

  /**
   * Manually trigger UFO to appear (Easter egg)
   * Auto-enables UFO layer if not already enabled
   */
  public triggerUFO(): void {
    // Auto-enable the layer when manually triggered
    if (!this.layerVisibility.ufo) {
      this.layerVisibility.ufo = true;
    }
    this.ufoSystem.trigger(this.lastDimensions);
  }

  /**
   * Check if UFO is currently visible
   */
  public isUFOActive(): boolean {
    return this.ufoSystem.isActive();
  }

  /**
   * Get current UFO state for UI display
   */
  public getUFOState(): string | null {
    return this.ufoSystem.getState();
  }

  // UFO Command Methods - for manual control
  public commandUFOScanStar(): boolean {
    return this.ufoSystem.commandScanStar();
  }

  public commandUFOScanGround(): void {
    this.ufoSystem.commandScanGround();
  }

  public commandUFOPause(): void {
    this.ufoSystem.commandPause();
  }

  public commandUFOWander(): void {
    this.ufoSystem.commandWander();
  }

  public commandUFODrift(): void {
    this.ufoSystem.commandDrift();
  }

  public commandUFOExit(): void {
    this.ufoSystem.commandExit();
  }

  /**
   * Trigger UFO with specific entrance animation
   */
  public triggerUFOWithEntrance(
    entranceType: import("./UFOSystem").UFOEntranceType
  ): void {
    if (!this.layerVisibility.ufo) {
      this.layerVisibility.ufo = true;
    }
    this.ufoSystem.triggerWithEntrance(this.lastDimensions, entranceType);
  }

  /**
   * Command UFO to exit with specific animation
   */
  public commandUFOExitWith(
    exitType: import("./UFOSystem").UFOExitType
  ): void {
    this.ufoSystem.commandExitWith(exitType);
  }

  /**
   * Get available entrance types for UI
   */
  public getUFOEntranceTypes(): import("./UFOSystem").UFOEntranceType[] {
    return this.ufoSystem.getAvailableEntranceTypes();
  }

  /**
   * Get available exit types for UI
   */
  public getUFOExitTypes(): import("./UFOSystem").UFOExitType[] {
    return this.ufoSystem.getAvailableExitTypes();
  }

  /**
   * Get current UFO entrance/exit types
   */
  public getUFOEntranceExitTypes(): {
    entrance: import("./UFOSystem").UFOEntranceType;
    exit: import("./UFOSystem").UFOExitType;
  } | null {
    return this.ufoSystem.getEntranceExitTypes();
  }

  /**
   * Handle click on canvas - UFO may react
   * @param clickX - Click X position in canvas coordinates
   * @param clickY - Click Y position in canvas coordinates
   * @returns true if UFO reacted to the click
   */
  public handleCanvasClick(clickX: number, clickY: number): boolean {
    if (!this.layerVisibility.ufo) return false;
    return this.ufoSystem.handleClick(clickX, clickY);
  }

  /**
   * Get current UFO mood
   */
  public getUFOMood(): import("./UFOSystem").UFOMood | null {
    return this.ufoSystem.getMood();
  }

  /**
   * Get UFO tiredness level (0-1)
   */
  public getUFOTiredness(): number | null {
    return this.ufoSystem.getTiredness();
  }

  /**
   * Set UFO mood externally
   */
  public setUFOMood(mood: import("./UFOSystem").UFOMood): void {
    this.ufoSystem.setMood(mood);
  }

  /**
   * Reset UFO tiredness to 0 (for testing)
   */
  public resetUFOTiredness(): void {
    this.ufoSystem.resetTiredness();
  }

  /**
   * Get count of scanned stars in UFO's memory
   */
  public getUFOScannedStarsCount(): number {
    return this.ufoSystem.getScannedStarsCount();
  }

  /**
   * Clear UFO's memory of scanned stars
   */
  public clearUFOScannedStars(): void {
    this.ufoSystem.clearScannedStars();
  }

  /**
   * Trigger UFO wobble animation (for testing)
   */
  public triggerUFOWobble(type: import("./UFOSystem").WobbleType): void {
    this.ufoSystem.triggerWobble(type);
  }

  /**
   * Get UFO heading in radians
   */
  public getUFOHeading(): number | null {
    return this.ufoSystem.getHeading();
  }

  /**
   * Get UFO position for UI display
   */
  public getUFOPosition(): { x: number; y: number } | null {
    return this.ufoSystem.getPosition();
  }

  private layerVisibility = {
    stars: true,
    nebula: true,
    aurora: true,
    milkyWay: true,
    meteors: true,
    comets: true,
    ufo: false, // Easter egg - off by default
  };

  /**
   * Handle viewport resize by adapting star systems to new dimensions
   */
  public handleResize(_oldDimensions: Dimensions, newDimensions: Dimensions) {
    if (this.isInitialized) {
      // Handle Milky Way resize
      this.milkyWaySystem.handleResize(newDimensions);
      this.milkyWayParticleSystem.handleResize(newDimensions);
      // Handle procedural nebula resize
      this.proceduralNebulaSystem.handleResize(newDimensions);
      // Handle aurora resize
      this.auroraSystem.handleResize(newDimensions);
      // The ParallaxStarSystem will automatically handle dimension changes in its update method
      // by calling adaptToNewDimensions when it detects dimension changes
      this.update(newDimensions);
    }
  }

  /* CLEANUP */
  public cleanup() {
    this.isInitialized = false;
    this.milkyWaySystem.cleanup();
    this.milkyWayParticleSystem.cleanup();
    this.parallaxStarSystem.cleanup();
    this.nebulaSystem.cleanup();
    this.proceduralNebulaSystem.cleanup();
    this.auroraSystem.cleanup();
    this.constellationSystem.cleanup();
    this.ufoSystem.cleanup();
    this.cometSystem.cleanup();
  }

  // Helper methods
  private getOptimizedConfig(quality: QualityLevel) {
    return this.configurationService.getOptimizedConfig(quality);
  }
}
