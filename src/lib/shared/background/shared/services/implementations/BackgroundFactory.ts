// src/lib/services/implementations/background/BackgroundFactory.ts
// Background Factory - Creates background animation systems with LAZY LOADING

import type {
  AccessibilitySettings,
  BackgroundSystem,
} from "../../domain/models/background-models";
import type { QualityLevel } from "../../domain/types/background-types";
import { BackgroundType } from "../../domain/enums/background-enums";
import { getContainerInstance } from "../../../../inversify/di";
import { TYPES } from "../../../../inversify/types";
import type { Container } from "inversify";

// BackgroundFactoryParams doesn't exist in domain - define locally
export interface BackgroundFactoryParams {
  type: BackgroundType;
  quality: QualityLevel;
  initialQuality: QualityLevel;
  accessibility?: Record<string, unknown>;
  thumbnailMode?: boolean;
  // Simple background settings
  backgroundColor?: string;
  gradientColors?: string[];
  gradientDirection?: number;
}

// detectAppropriateQuality function doesn't exist - define locally
function _detectAppropriateQuality(): QualityLevel {
  return "medium";
}

// Lazy loaders for background systems
const backgroundLoaders = {
  aurora: () => import("../../../aurora/services/AuroraBackgroundSystem"),
  snowfall: () => import("../../../snowfall/services/SnowfallBackgroundSystem"),
  nightSky: () =>
    import("../../../night-sky/services/NightSkyBackgroundSystem"),
  deepOcean: () =>
    import("../../../deep-ocean/services/DeepOceanBackgroundOrchestrator"),
  emberGlow: () =>
    import("../../../ember-glow/services/EmberGlowBackgroundSystem"),
  sakuraDrift: () =>
    import("../../../sakura-drift/services/SakuraDriftBackgroundSystem"),
  fireflyForest: () =>
    import("../../../firefly-forest/services/FireflyForestBackgroundSystem"),
  autumnDrift: () =>
    import("../../../autumn-drift/services/AutumnDriftBackgroundSystem"),
  simple: () => import("../../../simple/services/SimpleBackgroundSystem"),
};

// Track if DI modules are loaded
let _deepOceanModuleLoaded = false;
let _nightSkyModuleLoaded = false;

export class BackgroundFactory {
  // Default accessibility settings
  private static readonly defaultAccessibility: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 2,
  };

  /**
   * Load Night Sky DI module on-demand (only when Night Sky background is needed)
   */
  private static async loadNightSkyModule(): Promise<void> {
    // Use container.isBound() as the source of truth (survives code-splitting)
    const container = await getContainerInstance();
    if (container.isBound(TYPES.INightSkyCalculationService)) {
      return; // Already loaded
    }

    const { nightSkyBackgroundModule } =
      await import("../../../night-sky/inversify/NightSkyModule");
    await container.load(nightSkyBackgroundModule);
    _nightSkyModuleLoaded = true;
  }

  /**
   * Load Deep Ocean DI module on-demand (only when Deep Ocean background is needed)
   * @returns The container instance for resolving services
   */
  private static async loadDeepOceanModule(): Promise<Container> {
    // Use container.isBound() as the source of truth (survives code-splitting)
    const container = await getContainerInstance();
    if (!container.isBound(TYPES.IBubblePhysics)) {
      const { deepOceanBackgroundModule } =
        await import("../../../deep-ocean/inversify/DeepOceanModule");
      await container.load(deepOceanBackgroundModule);
      _deepOceanModuleLoaded = true;
    }
    return container;
  }

  public static async createBackgroundSystem(
    options: BackgroundFactoryParams
  ): Promise<BackgroundSystem> {
    // Quality detection logic
    const quality: QualityLevel = options.initialQuality;
    void quality; // Used for initial quality setup

    // Accessibility detection for window environments
    const accessibility: AccessibilitySettings = {
      ...this.defaultAccessibility,
      ...(options.accessibility ?? {}),
    };

    // Check for reduced motion preference
    if (typeof window !== "undefined") {
      try {
        const prefersReducedMotion = window.matchMedia(
          "(prefers-reduced-motion: reduce)"
        );
        if (prefersReducedMotion.matches) {
          accessibility.reducedMotion = true;
        }
      } catch (_error) {
        console.warn("Could not detect reduced motion preference:", _error);
      }
    }

    let backgroundSystem: BackgroundSystem;

    // Switch statement for background types - now with lazy loading
    switch (options.type) {
      case BackgroundType.AURORA: {
        const { AuroraBackgroundSystem } = await backgroundLoaders.aurora();
        backgroundSystem = new AuroraBackgroundSystem();
        break;
      }
      case BackgroundType.SNOWFALL: {
        const { SnowfallBackgroundSystem } = await backgroundLoaders.snowfall();
        backgroundSystem = new SnowfallBackgroundSystem();
        break;
      }
      case BackgroundType.NIGHT_SKY: {
        // Load Night Sky DI module on-demand (services only loaded when needed)
        await this.loadNightSkyModule();

        const { NightSkyBackgroundSystem } = await backgroundLoaders.nightSky();
        backgroundSystem = NightSkyBackgroundSystem.create();
        break;
      }
      case BackgroundType.DEEP_OCEAN: {
        // Load Deep Ocean DI module on-demand (services only loaded when needed)
        const container = await this.loadDeepOceanModule();

        const { DeepOceanBackgroundOrchestrator } =
          await backgroundLoaders.deepOcean();
        // Use the refactored orchestrator with all split services from container
        backgroundSystem = new DeepOceanBackgroundOrchestrator(
          // Physics services
          container.get(TYPES.IBubblePhysics),
          container.get(TYPES.IParticleSystem),
          container.get(TYPES.ILightRayCalculator),
          // Animator services
          container.get(TYPES.IFishAnimator),
          container.get(TYPES.IJellyfishAnimator),
          // Renderer services
          container.get(TYPES.IGradientRenderer),
          container.get(TYPES.ILightRayRenderer),
          container.get(TYPES.IBubbleRenderer),
          container.get(TYPES.IParticleRenderer),
          container.get(TYPES.IFishRenderer),
          container.get(TYPES.IJellyfishRenderer)
        );
        break;
      }
      case BackgroundType.EMBER_GLOW: {
        const { EmberGlowBackgroundSystem } =
          await backgroundLoaders.emberGlow();
        backgroundSystem = new EmberGlowBackgroundSystem();
        break;
      }
      case BackgroundType.SAKURA_DRIFT: {
        const { SakuraDriftBackgroundSystem } =
          await backgroundLoaders.sakuraDrift();
        backgroundSystem = new SakuraDriftBackgroundSystem();
        break;
      }
      case BackgroundType.FIREFLY_FOREST: {
        const { FireflyForestBackgroundSystem } =
          await backgroundLoaders.fireflyForest();
        backgroundSystem = new FireflyForestBackgroundSystem();
        break;
      }
      case BackgroundType.AUTUMN_DRIFT: {
        const { AutumnDriftBackgroundSystem } =
          await backgroundLoaders.autumnDrift();
        backgroundSystem = new AutumnDriftBackgroundSystem();
        break;
      }
      case BackgroundType.SOLID_COLOR: {
        const { SimpleBackgroundSystem } = await backgroundLoaders.simple();
        backgroundSystem = new SimpleBackgroundSystem({
          type: "solid",
          color: options.backgroundColor ?? "#1a1a2e",
        });
        break;
      }
      case BackgroundType.LINEAR_GRADIENT: {
        const { SimpleBackgroundSystem } = await backgroundLoaders.simple();
        backgroundSystem = new SimpleBackgroundSystem({
          type: "gradient",
          colors: options.gradientColors ?? ["#667eea", "#764ba2"],
          direction: options.gradientDirection ?? 135,
        });
        break;
      }
      default: {
        console.warn(
          `Background type "${String(options.type)}" not implemented. Defaulting to Aurora.`
        );
        const { AuroraBackgroundSystem } = await backgroundLoaders.aurora();
        backgroundSystem = new AuroraBackgroundSystem();
      }
    }

    // Apply accessibility settings if the background system supports them
    if (backgroundSystem.setAccessibility) {
      backgroundSystem.setAccessibility(accessibility);
    }

    // Apply thumbnail mode if specified and supported
    if (options.thumbnailMode && "setThumbnailMode" in backgroundSystem) {
      (
        backgroundSystem as { setThumbnailMode: (enabled: boolean) => void }
      ).setThumbnailMode(true);
    }

    // Set initial quality
    backgroundSystem.setQuality(quality);

    return backgroundSystem;
  }

  public static async createOptimalBackgroundSystem(): Promise<BackgroundSystem> {
    const quality = _detectAppropriateQuality();

    // Default to nightSky as the preferred background
    return await this.createBackgroundSystem({
      type: BackgroundType.NIGHT_SKY,
      quality,
      initialQuality: quality,
    });
  }

  public static isBackgroundSupported(type: BackgroundType): boolean {
    const quality = _detectAppropriateQuality();

    switch (type) {
      case BackgroundType.SNOWFALL:
      case BackgroundType.NIGHT_SKY:
      case BackgroundType.AURORA:
      case BackgroundType.DEEP_OCEAN:
      case BackgroundType.EMBER_GLOW:
      case BackgroundType.SAKURA_DRIFT:
      case BackgroundType.FIREFLY_FOREST:
      case BackgroundType.AUTUMN_DRIFT:
        return quality !== "minimal";
      default:
        return false;
    }
  }

  public static getSupportedBackgroundTypes(): BackgroundType[] {
    return [
      BackgroundType.NIGHT_SKY,
      BackgroundType.SNOWFALL,
      BackgroundType.AURORA,
      BackgroundType.DEEP_OCEAN,
      BackgroundType.EMBER_GLOW,
      BackgroundType.SAKURA_DRIFT,
      BackgroundType.FIREFLY_FOREST,
      BackgroundType.AUTUMN_DRIFT,
      BackgroundType.SOLID_COLOR,
      BackgroundType.LINEAR_GRADIENT,
    ];
  }
}
