const JACARANDA_FOLIAGE_PATTERN = /jacaranda_tree_leaves/i;
const SEMANTIC_SUMMER_FOLIAGE_PATTERN =
  /(?:Cathedral European Beech R2|Fluted European Hornbeam R2|Airy Silver Birch|Tall Tulip Tree R5|Shagbark Hickory|Mottled American Sycamore R2)_Foliage/i;
const PHOTOGRAPHIC_FOLIAGE_PATTERN =
  /jacaranda_tree_leaves|island_tree_\d+_leaves|tree_small_\d+_leaves|fir_tree.*(?:twig|needle|leaf)|fir_sapling.*(?:twig|needle|leaf)/i;
const SEMANTIC_CANOPY_LOD_PATTERN = /ForestSemanticCanopy_.*_canopy_lod/i;

export const FOREST_JACARANDA_FOLIAGE_LUMINANCE_SCALE = 0.58;
export const FOREST_JACARANDA_GREEN_SIGNAL_FLOOR = 1;
export const FOREST_SEMANTIC_FOLIAGE_GREEN_SIGNAL_FLOOR = 1;

const SEMANTIC_SUMMER_LUMINANCE_SCALES = [
  [/Cathedral European Beech R2_Foliage/i, 0.76],
  [/Fluted European Hornbeam R2_Foliage/i, 0.63],
  [/Airy Silver Birch_Foliage/i, 0.72],
  [/Tall Tulip Tree R5_Foliage/i, 0.82],
  [/Shagbark Hickory_Foliage/i, 0.42],
  [/Mottled American Sycamore R2_Foliage/i, 0.67],
] as const;

export const FOREST_FOLIAGE_GREEN_SIGNAL_START = 0.01;
export const FOREST_FOLIAGE_GREEN_SIGNAL_END = 0.14;
export const FOREST_NEAR_FRAME_INDIRECT_DEPTH = 0.24;
export const FOREST_FOLIAGE_SKY_EXPOSURE_START = -0.35;
export const FOREST_FOLIAGE_SKY_EXPOSURE_END = 0.75;
export const FOREST_CANOPY_LOD_DISTANCE_START = 32;
export const FOREST_CANOPY_LOD_DISTANCE_END = 58;
export const FOREST_CANOPY_LOD_ALPHA_COVERAGE_POWER = 6;
export const FOREST_SEMANTIC_CANOPY_DISTANCE_START = 24;
export const FOREST_SEMANTIC_CANOPY_DISTANCE_END = 48;
export const FOREST_SEMANTIC_CANOPY_MAX_COVERAGE = 0.72;

export type ForestFoliageScope =
  | "environment"
  | "near-frame"
  | "stage"
  | "camp";

export interface ForestLinearRgb {
  r: number;
  g: number;
  b: number;
}

export interface ForestFoliageAlphaTreatment {
  alphaHash: boolean;
  alphaTest: number;
}

const LINEAR_LUMINANCE = {
  r: 0.2126,
  g: 0.7152,
  b: 0.0722,
} as const;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const progress = clamp01((value - edge0) / (edge1 - edge0));
  return progress * progress * (3 - 2 * progress);
}

function linearLuminance(color: ForestLinearRgb): number {
  return (
    color.r * LINEAR_LUMINANCE.r +
    color.g * LINEAR_LUMINANCE.g +
    color.b * LINEAR_LUMINANCE.b
  );
}

/**
 * Poly Haven foliage uses photographic cutouts. Their mostly binary alpha
 * masks average below the authored 0.35 alpha cutoff in distant mip levels,
 * which can erase a healthy crown from world and overhead cameras. Alpha hash
 * preserves that fractional coverage without exposing the card silhouette.
 */
export function resolveForestFoliageAlphaTreatment(
  materialName: string,
  sourceAlphaTest: number
): ForestFoliageAlphaTreatment {
  if (
    !PHOTOGRAPHIC_FOLIAGE_PATTERN.test(materialName) &&
    !SEMANTIC_CANOPY_LOD_PATTERN.test(materialName)
  ) {
    return { alphaHash: false, alphaTest: sourceAlphaTest };
  }
  return { alphaHash: true, alphaTest: 0 };
}

export function calculateForestCanopyLodVisibility(distance: number): number {
  return smoothstep(
    FOREST_CANOPY_LOD_DISTANCE_START,
    FOREST_CANOPY_LOD_DISTANCE_END,
    distance
  );
}

export function calculateForestCanopyLodAlphaCoverage(alpha: number): number {
  const clampedAlpha = clamp01(alpha);
  return 1 - (1 - clampedAlpha) ** FOREST_CANOPY_LOD_ALPHA_COVERAGE_POWER;
}

/**
 * The Jacaranda atlas is authored as a pale silver-green canopy. Give that
 * family enough chroma correction to read as summer foliage while leaving the
 * naturally green Poly Haven families close to their source photography.
 */
export function resolveForestFoliageGradeCoverage(
  materialName: string
): number {
  if (SEMANTIC_SUMMER_FOLIAGE_PATTERN.test(materialName)) return 1;
  return JACARANDA_FOLIAGE_PATTERN.test(materialName) ? 1.28 : 0.82;
}

/**
 * The Jacaranda atlas is materially brighter than the other summer families.
 * A multiplicative family grade keeps every authored highlight and shadow in
 * proportion while bringing that canopy into the same exposure range.
 */
export function resolveForestFoliageLuminanceScale(
  materialName: string
): number {
  if (JACARANDA_FOLIAGE_PATTERN.test(materialName)) {
    return FOREST_JACARANDA_FOLIAGE_LUMINANCE_SCALE;
  }
  for (const [pattern, scale] of SEMANTIC_SUMMER_LUMINANCE_SCALES) {
    if (pattern.test(materialName)) return scale;
  }
  return 1;
}

export function resolveForestFoliageGreenSignalFloor(
  materialName: string
): number {
  if (JACARANDA_FOLIAGE_PATTERN.test(materialName)) {
    return FOREST_JACARANDA_GREEN_SIGNAL_FLOOR;
  }
  return SEMANTIC_SUMMER_FOLIAGE_PATTERN.test(materialName)
    ? FOREST_SEMANTIC_FOLIAGE_GREEN_SIGNAL_FLOOR
    : 0;
}

export function calculateForestFoliageGreenSignal(
  color: ForestLinearRgb
): number {
  const greenSeparation = color.g - Math.max(color.r, color.b);
  return smoothstep(
    FOREST_FOLIAGE_GREEN_SIGNAL_START,
    FOREST_FOLIAGE_GREEN_SIGNAL_END,
    greenSeparation
  );
}

export function resolveForestFoliageGradeWeight(
  materialName: string,
  strength: number,
  greenSignal: number
): number {
  return clamp01(
    strength *
      resolveForestFoliageGradeCoverage(materialName) *
      clamp01(greenSignal)
  );
}

/** Mirrors the runtime fragment grade so luminance and color gating stay testable. */
export function applyForestFoliageGrade(
  color: ForestLinearRgb,
  tint: ForestLinearRgb,
  materialName: string,
  strength: number
): ForestLinearRgb {
  const sourceLuminance = linearLuminance(color);
  const targetLuminance =
    sourceLuminance * resolveForestFoliageLuminanceScale(materialName);
  const tintLuminance = Math.max(linearLuminance(tint), 0.001);
  const luminanceMatchedTint = {
    r: tint.r * (targetLuminance / tintLuminance),
    g: tint.g * (targetLuminance / tintLuminance),
    b: tint.b * (targetLuminance / tintLuminance),
  };
  const weight = resolveForestFoliageGradeWeight(
    materialName,
    strength,
    Math.max(
      calculateForestFoliageGreenSignal(color),
      resolveForestFoliageGreenSignalFloor(materialName)
    )
  );

  return {
    r: color.r + (luminanceMatchedTint.r - color.r) * weight,
    g: color.g + (luminanceMatchedTint.g - color.g) * weight,
    b: color.b + (luminanceMatchedTint.b - color.b) * weight,
  };
}

export function resolveForestFoliageIndirectDepth(
  scope: ForestFoliageScope
): number {
  return scope === "near-frame" ? FOREST_NEAR_FRAME_INDIRECT_DEPTH : 0;
}

export function calculateForestFoliageSkyExposure(
  upFacingAmount: number
): number {
  return smoothstep(
    FOREST_FOLIAGE_SKY_EXPOSURE_START,
    FOREST_FOLIAGE_SKY_EXPOSURE_END,
    upFacingAmount
  );
}

export function resolveForestIndirectLightRetention(
  depthStrength: number,
  skyExposure: number
): number {
  return 1 - clamp01(depthStrength) * (1 - clamp01(skyExposure));
}
