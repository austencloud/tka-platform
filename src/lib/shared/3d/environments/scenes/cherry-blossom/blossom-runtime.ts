export type BlossomQualityTier = "high" | "medium" | "low";

export interface BlossomQualitySignals {
  userAgent: string;
  hardwareConcurrency: number;
  gpuRenderer: string;
}

export interface BlossomRuntimeInput {
  tier: BlossomQualityTier;
  prefersReducedMotion: boolean;
  stageWidth: number;
  stageDepth: number;
  stageZOffset: number;
  groundY: number;
  particleCounts: {
    petals: number;
    distantPetals: number;
    fireflies: number;
  };
  lightIntensities: {
    hemisphere: number;
    key: number;
  };
}

export interface BlossomRuntimeConfig {
  tier: BlossomQualityTier;
  particles: {
    petals: number;
    distantPetals: number;
    fireflies: number;
  };
  lights: {
    hemisphere: number;
    key: number;
  };
  effects: {
    shadows: boolean;
    shadowMapSize: number;
    reflectiveWater: boolean;
    lanternLights: number;
    stars: number;
  };
  maxPixelRatio: number;
  stage: BlossomStageTransform;
}

export interface BlossomStageTransform {
  position: [number, number, number];
  scale: [number, number, number];
  atmosphereScale: number;
  stageTopY: number;
}

interface BlossomQualityPreset {
  particleScale: number;
  distantPetalScale: number;
  fireflyScale: number;
  hemisphereLightScale: number;
  keyLightScale: number;
  shadows: boolean;
  shadowMapSize: number;
  reflectiveWater: boolean;
  lanternLights: number;
  stars: number;
  maxPixelRatio: number;
}

const AUTHORING_STAGE_RADIUS = 5;
const AUTHORING_STAGE_TOP_Y = 0.35;
const QUALITY_PRESETS: Record<BlossomQualityTier, BlossomQualityPreset> = {
  high: {
    particleScale: 1,
    distantPetalScale: 1,
    fireflyScale: 1,
    hemisphereLightScale: 1,
    keyLightScale: 1,
    shadows: true,
    shadowMapSize: 2048,
    reflectiveWater: true,
    lanternLights: 3,
    stars: 640,
    maxPixelRatio: 2,
  },
  medium: {
    particleScale: 0.72,
    distantPetalScale: 0.64,
    fireflyScale: 0.64,
    hemisphereLightScale: 0.92,
    keyLightScale: 0.9,
    shadows: false,
    shadowMapSize: 1024,
    reflectiveWater: false,
    lanternLights: 2,
    stars: 440,
    maxPixelRatio: 1.5,
  },
  low: {
    particleScale: 0.4,
    distantPetalScale: 0.28,
    fireflyScale: 0.3,
    hemisphereLightScale: 0.82,
    keyLightScale: 0.8,
    shadows: false,
    shadowMapSize: 1024,
    reflectiveWater: false,
    lanternLights: 0,
    stars: 260,
    maxPixelRatio: 1,
  },
};

export function detectBlossomQuality(
  signals: BlossomQualitySignals
): BlossomQualityTier {
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(signals.userAgent);
  const isLowEndGpu = /SwiftShader|llvmpipe|Mali-4|Adreno [23]/i.test(
    signals.gpuRenderer
  );

  if (isMobile || isLowEndGpu || signals.hardwareConcurrency <= 4) {
    return "low";
  }

  if (/Intel|integrated|UHD|Iris/i.test(signals.gpuRenderer)) {
    return "medium";
  }

  return "high";
}

export function createBlossomStageTransform(input: {
  stageWidth: number;
  stageDepth: number;
  stageZOffset: number;
  groundY: number;
}): BlossomStageTransform {
  const stageHalfDiagonal = Math.hypot(
    input.stageWidth / 2,
    input.stageDepth / 2
  );
  const atmosphereScale = Math.max(
    1,
    stageHalfDiagonal / AUTHORING_STAGE_RADIUS
  );

  return {
    position: [0, input.groundY, input.stageZOffset],
    // Formation dimensions may widen the petal field, but never the authored
    // garden. Scaling the whole GLB stretched tree crowns, moved every hero
    // prop out of frame, and turned large formations into an empty platform.
    scale: [1, 1, 1],
    atmosphereScale,
    stageTopY: input.groundY + AUTHORING_STAGE_TOP_Y,
  };
}

export function createBlossomRuntimeConfig(
  input: BlossomRuntimeInput
): BlossomRuntimeConfig {
  const preset = QUALITY_PRESETS[input.tier];
  const motionScale = input.prefersReducedMotion ? 0 : 1;

  return {
    tier: input.tier,
    particles: {
      petals: Math.round(
        input.particleCounts.petals * preset.particleScale * motionScale
      ),
      distantPetals: Math.round(
        input.particleCounts.distantPetals *
          preset.distantPetalScale *
          motionScale
      ),
      fireflies: Math.round(
        input.particleCounts.fireflies * preset.fireflyScale * motionScale
      ),
    },
    lights: {
      hemisphere:
        input.lightIntensities.hemisphere * preset.hemisphereLightScale,
      key: input.lightIntensities.key * preset.keyLightScale,
    },
    effects: {
      shadows: preset.shadows,
      shadowMapSize: preset.shadowMapSize,
      reflectiveWater: preset.reflectiveWater,
      lanternLights: preset.lanternLights,
      stars: preset.stars,
    },
    maxPixelRatio: preset.maxPixelRatio,
    stage: createBlossomStageTransform(input),
  };
}
