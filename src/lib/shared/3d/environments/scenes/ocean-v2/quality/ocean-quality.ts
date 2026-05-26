import type { WebGLRenderer } from "three";

export type OceanQualityTier = "ultra" | "medium" | "low";

export interface OceanQualityConfig {
  tier: OceanQualityTier;
  // Dynamic entity counts only — static content renders the same at all tiers
  maxFishCount: number;
  maxJellyfish: number;
  particleCount: number;
  maxPixelRatio: number;
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
    enableGodRays: true,
    godRayHalfRes: true,
    enableBloom: true,
    enableChromaticAberration: true,
    enableAbsorption: true,
  },
  low: {
    tier: "low",
    maxFishCount: 30,
    maxJellyfish: 0,
    particleCount: 500,
    maxPixelRatio: 1,
    enableGodRays: false,
    godRayHalfRes: false,
    enableBloom: false,
    enableChromaticAberration: false,
    enableAbsorption: true,
  },
};

export function detectOceanQuality(renderer: WebGLRenderer | null): OceanQualityTier {
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

export function getOceanQualityConfig(tier: OceanQualityTier): OceanQualityConfig {
  return { ...TIER_PRESETS[tier] };
}
