/** Rainbow environment configuration and production defaults. */

import type {
  FogConfig,
  HemisphereLightConfig,
  PrismPlatformConfig,
} from "./shared-scene-config";

export interface RainbowSceneConfig {
  fog: FogConfig;
  hemisphereLight: HemisphereLightConfig;
  platform: PrismPlatformConfig;
}

export function createDefaultRainbowConfig(): RainbowSceneConfig {
  return {
    fog: { color: "#08001a", density: 0.008 },
    hemisphereLight: {
      skyColor: "#ffffff",
      groundColor: "#222244",
      intensity: 0.7,
    },
    platform: {
      enabled: true,
      radius: 5,
      height: 0.4,
      glowIntensity: 0.7,
      spectrumSpeed: 0.15,
    },
  };
}
