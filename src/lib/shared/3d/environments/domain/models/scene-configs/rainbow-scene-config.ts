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
    fog: { color: "#07111f", density: 0.0015 },
    hemisphereLight: {
      skyColor: "#a6c2e6",
      groundColor: "#3d2924",
      intensity: 0.45,
    },
    platform: {
      enabled: true,
      radius: 6,
      height: 0.4,
      glowIntensity: 1,
      spectrumSpeed: 0.6,
    },
  };
}
