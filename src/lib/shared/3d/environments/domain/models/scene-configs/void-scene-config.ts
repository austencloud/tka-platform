/** Pure-black environment configuration and production defaults. */

import type { VoidPlatformConfig } from "./shared-scene-config";

export interface VoidSceneConfig {
  ambientIntensity: number;
  platform: VoidPlatformConfig;
}

export function createDefaultVoidConfig(): VoidSceneConfig {
  return {
    ambientIntensity: 0.5,
    platform: {
      enabled: true,
      radius: 5,
      height: 0.35,
      gridColor: "#00aaff",
      glowIntensity: 0.6,
      gridDensity: 1.0,
    },
  };
}
