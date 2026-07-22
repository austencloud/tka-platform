import type { WebGLRenderer } from "three";

export type OceanQualityTier = "ultra" | "medium" | "low";

export interface OceanQualityConfig {
  tier: OceanQualityTier;
  maxFishCount: number;
  maxJellyfish: number;
  particleCount: number;
  maxPixelRatio: number;
  // The authored reef pushes roughly 54 million vertices per frame. Phones
  // need a real content LOD, not just fewer fish over the same reef.
  enableAuthoredFlora: boolean;
  enableImageBasedLighting: boolean;
  enableCaustics: boolean;
  enableWaterSurface: boolean;
  enableAtmosphere: boolean;
  enableFauna: boolean;
  // God ray quality
  enableGodRays: boolean;
  godRayHalfRes: boolean;
  // Post-processing
  enableBloom: boolean;
  enableChromaticAberration: boolean;
  enableAbsorption: boolean;
}

const TIER_PRESETS: Record<OceanQualityTier, OceanQualityConfig> = {
  ultra: {
    tier: "ultra",
    maxFishCount: 200,
    maxJellyfish: 20,
    particleCount: 4000,
    maxPixelRatio: 2,
    enableAuthoredFlora: true,
    enableImageBasedLighting: true,
    enableCaustics: true,
    enableWaterSurface: true,
    enableAtmosphere: true,
    enableFauna: true,
    enableGodRays: true,
    godRayHalfRes: false,
    enableBloom: true,
    enableChromaticAberration: true,
    enableAbsorption: true,
  },
  medium: {
    tier: "medium",
    maxFishCount: 100,
    maxJellyfish: 8,
    particleCount: 1500,
    maxPixelRatio: 1.5,
    // The authored reef is an Ultra-only asset. Even a sparse runtime draw
    // would still make lower tiers download and decode the 35 MB / 2M-vertex
    // source before the adaptive probe knows whether the device can sustain it.
    enableAuthoredFlora: false,
    enableImageBasedLighting: true,
    enableCaustics: true,
    enableWaterSurface: true,
    enableAtmosphere: true,
    enableFauna: true,
    enableGodRays: true,
    godRayHalfRes: true,
    enableBloom: true,
    enableChromaticAberration: true,
    enableAbsorption: true,
  },
  low: {
    tier: "low",
    maxFishCount: 0,
    maxJellyfish: 0,
    particleCount: 0,
    maxPixelRatio: 1,
    enableAuthoredFlora: false,
    enableImageBasedLighting: false,
    enableCaustics: false,
    enableWaterSurface: false,
    enableAtmosphere: false,
    enableFauna: false,
    enableGodRays: false,
    godRayHalfRes: false,
    enableBloom: false,
    enableChromaticAberration: false,
    enableAbsorption: false,
  },
};

export function detectOceanQuality(
  renderer: WebGLRenderer | null
): OceanQualityTier {
  if (!renderer) return "ultra";
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
  const gpuRenderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : "";
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEnd = /SwiftShader|llvmpipe|Mali-4|Adreno [23]/i.test(gpuRenderer);
  const cores = navigator.hardwareConcurrency ?? 4;
  if (isMobile || isLowEnd || cores <= 4) return "low";
  if (/Intel|integrated|UHD|Iris/i.test(gpuRenderer)) return "medium";
  return "ultra";
}

export function getOceanQualityConfig(
  tier: OceanQualityTier
): OceanQualityConfig {
  return { ...TIER_PRESETS[tier] };
}
