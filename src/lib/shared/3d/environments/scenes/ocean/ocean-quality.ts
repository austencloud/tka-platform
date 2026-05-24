import type { WebGLRenderer } from 'three';

export type OceanQualityTier = 'ultra' | 'medium' | 'low';

export interface OceanQualityConfig {
  tier: OceanQualityTier;

  maxCoralCount: number;
  maxKelpCount: number;
  maxHeroKelp: number;
  maxMidKelp: number;
  maxBackgroundKelp: number;
  maxFishCount: number;
  maxHeroRocks: number;
  maxReefStructures: number;
  maxJellyfish: number;
  maxGodRayShafts: number;
  particleCount: number;
  bubbleCount: number;

  seabedSegments: number;
  waterSurfaceSegments: number;

  seabedFbmOctaves: number;
  enableCaustics: boolean;
  enableSparkle: boolean;
  godRayFrequencies: number;

  enableBloom: boolean;
  bloomResolutionScale: number;
  bloomLevels: number;
  enableChromaticAberration: boolean;
  maxPixelRatio: number;

  enableJellyfishLights: boolean;
}

const TIER_PRESETS: Record<OceanQualityTier, OceanQualityConfig> = {
  ultra: {
    tier: 'ultra',
    maxCoralCount: 200,
    maxKelpCount: 80,
    maxHeroKelp: 4,
    maxMidKelp: 40,
    maxBackgroundKelp: 80,
    maxFishCount: 200,
    maxHeroRocks: 40,
    maxReefStructures: 4,
    maxJellyfish: 20,
    maxGodRayShafts: 12,
    particleCount: 4000,
    bubbleCount: 200,
    seabedSegments: 192,
    waterSurfaceSegments: 64,
    seabedFbmOctaves: 5,
    enableCaustics: true,
    enableSparkle: true,
    godRayFrequencies: 4,
    enableBloom: true,
    bloomResolutionScale: 1.0,
    bloomLevels: 8,
    enableChromaticAberration: true,
    maxPixelRatio: 2,
    enableJellyfishLights: true,
  },
  medium: {
    tier: 'medium',
    maxCoralCount: 80,
    maxKelpCount: 30,
    maxHeroKelp: 2,
    maxMidKelp: 15,
    maxBackgroundKelp: 30,
    maxFishCount: 100,
    maxHeroRocks: 15,
    maxReefStructures: 2,
    maxJellyfish: 8,
    maxGodRayShafts: 6,
    particleCount: 1500,
    bubbleCount: 100,
    seabedSegments: 96,
    waterSurfaceSegments: 32,
    seabedFbmOctaves: 3,
    enableCaustics: true,
    enableSparkle: false,
    godRayFrequencies: 2,
    enableBloom: true,
    bloomResolutionScale: 0.5,
    bloomLevels: 5,
    enableChromaticAberration: true,
    maxPixelRatio: 1.5,
    enableJellyfishLights: false,
  },
  low: {
    tier: 'low',
    maxCoralCount: 30,
    maxKelpCount: 10,
    maxHeroKelp: 0,
    maxMidKelp: 8,
    maxBackgroundKelp: 0,
    maxFishCount: 30,
    maxHeroRocks: 5,
    maxReefStructures: 0,
    maxJellyfish: 0,
    maxGodRayShafts: 3,
    particleCount: 500,
    bubbleCount: 50,
    seabedSegments: 48,
    waterSurfaceSegments: 16,
    seabedFbmOctaves: 2,
    enableCaustics: false,
    enableSparkle: false,
    godRayFrequencies: 0,
    enableBloom: false,
    bloomResolutionScale: 1.0,
    bloomLevels: 0,
    enableChromaticAberration: false,
    maxPixelRatio: 1,
    enableJellyfishLights: false,
  },
};

export function detectOceanQuality(renderer: WebGLRenderer): OceanQualityTier {
  const gl = renderer.getContext();
  const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
  const gpuRenderer = debugInfo
    ? gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
    : '';

  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
  const isLowEnd = /SwiftShader|llvmpipe|Mali-4|Adreno [23]/i.test(gpuRenderer);
  const cores = navigator.hardwareConcurrency ?? 4;

  if (isMobile || isLowEnd || cores <= 4) return 'low';
  if (/Intel|integrated|UHD|Iris/i.test(gpuRenderer)) return 'medium';
  return 'ultra';
}

export function getOceanQualityConfig(tier: OceanQualityTier): OceanQualityConfig {
  return { ...TIER_PRESETS[tier] };
}
