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
  maxPixelRatio: number;
  stage: BlossomStageTransform;
}

export interface BlossomStageTransform {
  position: [number, number, number];
  scale: [number, number, number];
  horizontalScale: number;
  stageTopY: number;
}

interface BlossomQualityPreset {
  particleScale: number;
  distantPetalScale: number;
  fireflyScale: number;
  hemisphereLightScale: number;
  keyLightScale: number;
  maxPixelRatio: number;
}

const AUTHORING_STAGE_RADIUS = 5;
const AUTHORING_STAGE_TOP_Y = 0.35;
const CLEARING_SAFETY_MARGIN = 0.08;

const QUALITY_PRESETS: Record<BlossomQualityTier, BlossomQualityPreset> = {
  high: {
    particleScale: 1,
    distantPetalScale: 1,
    fireflyScale: 1,
    hemisphereLightScale: 1,
    keyLightScale: 1,
    maxPixelRatio: 2,
  },
  medium: {
    particleScale: 0.65,
    distantPetalScale: 0.65,
    fireflyScale: 0.6,
    hemisphereLightScale: 0.92,
    keyLightScale: 0.9,
    maxPixelRatio: 1.5,
  },
  low: {
    particleScale: 0.35,
    distantPetalScale: 0,
    fireflyScale: 0,
    hemisphereLightScale: 0.82,
    keyLightScale: 0.8,
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
  const horizontalScale = Math.max(
    1,
    stageHalfDiagonal / AUTHORING_STAGE_RADIUS + CLEARING_SAFETY_MARGIN
  );

  return {
    position: [0, input.groundY, input.stageZOffset],
    scale: [horizontalScale, 1, horizontalScale],
    horizontalScale,
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
    maxPixelRatio: preset.maxPixelRatio,
    stage: createBlossomStageTransform(input),
  };
}
