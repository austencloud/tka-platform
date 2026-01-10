// src/lib/services/implementations/background/BackgroundFactory.ts
// Background Factory - Creates background animation systems with LAZY LOADING

import type {
  AccessibilitySettings,
  BackgroundSystem,
} from "../../domain/models/background-models";
import type { QualityLevel } from "../../domain/types/background-types";
import { BackgroundType } from "../../domain/enums/background-enums";
import { container } from "$lib/shared/di";

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
  pride: () => import("../../../rainbow/services/RainbowBackgroundSystem"),
  snowfall: () => import("../../../snowfall/services/SnowfallBackgroundSystem"),
  nightSky: () =>
    import("../../../night-sky/services/NightSkyBackgroundSystem"),
  deepOcean: () =>
    import("../../../deep-ocean/services/DeepOceanBackgroundOrchestrator"),
  emberGlow: () =>
    import("../../../ember-glow/services/EmberGlowBackgroundSystem"),
  cherryBlossom: () =>
    import("../../../cherry-blossom/services/CherryBlossomBackgroundSystem"),
  fireflyForest: () =>
    import("../../../firefly-forest/services/FireflyForestBackgroundSystem"),
  autumnDrift: () =>
    import("../../../autumn-drift/services/AutumnDriftBackgroundSystem"),
  simple: () => import("../../../simple/services/SimpleBackgroundSystem"),
};

export class BackgroundFactory {
  // Default accessibility settings
  private static readonly defaultAccessibility: AccessibilitySettings = {
    reducedMotion: false,
    highContrast: false,
    visibleParticleSize: 2,
  };

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
      case BackgroundType.PRIDE: {
        const { RainbowBackgroundSystem } = await backgroundLoaders.pride();
        backgroundSystem = new RainbowBackgroundSystem();
        break;
      }
      case BackgroundType.SNOWFALL: {
        const { SnowfallBackgroundSystem } = await backgroundLoaders.snowfall();
        backgroundSystem = new SnowfallBackgroundSystem();
        break;
      }
      case BackgroundType.NIGHT_SKY: {
        // Night Sky services are now in ITI container (no inversify module needed)
        const { NightSkyBackgroundSystem } = await backgroundLoaders.nightSky();
        backgroundSystem = NightSkyBackgroundSystem.create();
        break;
      }
      case BackgroundType.DEEP_OCEAN: {
        // Deep Ocean services are now in ITI container
        backgroundSystem = container.items.deepOceanBackgroundSystem;
        break;
      }
      case BackgroundType.EMBER_GLOW: {
        const { EmberGlowBackgroundSystem } =
          await backgroundLoaders.emberGlow();
        backgroundSystem = new EmberGlowBackgroundSystem();
        break;
      }
      case BackgroundType.SAKURA_DRIFT: {
        const { CherryBlossomBackgroundSystem } =
          await backgroundLoaders.cherryBlossom();
        backgroundSystem = new CherryBlossomBackgroundSystem();
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
          `Background type "${String(options.type)}" not implemented. Defaulting to Pride.`
        );
        const { RainbowBackgroundSystem } = await backgroundLoaders.pride();
        backgroundSystem = new RainbowBackgroundSystem();
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
      case BackgroundType.PRIDE:
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
      BackgroundType.PRIDE,
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
