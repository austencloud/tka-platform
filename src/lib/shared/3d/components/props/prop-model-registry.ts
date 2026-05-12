/**
 * Prop Model Registry
 *
 * Maps PropType values to their GLTF model paths and metadata.
 * Models are loaded from the R2 CDN when available, with local
 * fallback paths for development.
 *
 * Each entry specifies:
 * - modelUrl: path to the .glb file
 * - scale: uniform scale to apply (models may have different authored sizes)
 * - gripOffset: Y offset to align the model's grip point with the origin
 */

import { PropType } from "$lib/shared/pictograph/prop/domain/enums/PropType";

export interface PropModelEntry {
  /** URL or path to the .glb model file */
  modelUrl: string;
  /** Uniform scale multiplier (default 1) */
  scale: number;
  /** Y offset to align grip point with origin (0 = model's origin IS the grip) */
  gripOffsetY: number;
}

/** R2 CDN base URL - same CDN used by forest/camping models */
const R2_CDN = "https://pub-f5505ed75927471cb198c54336317370.r2.dev";

/** Local fallback for development */
const LOCAL_PATH = "/models/props";

/**
 * Build a model URL, preferring R2 CDN with local fallback.
 * Set USE_CDN to true once models are uploaded to R2.
 */
const USE_CDN = false;
function _modelUrl(filename: string): string {
  return USE_CDN
    ? `${R2_CDN}/models/props/${filename}`
    : `${LOCAL_PATH}/${filename}`;
}

/**
 * Registry of available GLTF prop models.
 *
 * Props NOT in this registry will use procedural fallback geometry.
 * Add entries as models become available - the system degrades gracefully.
 */
export const PROP_MODEL_REGISTRY: Partial<Record<PropType, PropModelEntry>> = {
  // Models will be added here as they're generated.
  // Example:
  // [PropType.CLUB]: { modelUrl: modelUrl("club.glb"), scale: 1, gripOffsetY: 0 },
  // [PropType.FAN]: { modelUrl: modelUrl("fan.glb"), scale: 1, gripOffsetY: 0 },
};

/**
 * Look up a GLTF model for a prop type. Returns null if no model
 * is available (caller should fall back to procedural geometry).
 */
export function getPropModel(propType: PropType): PropModelEntry | null {
  return PROP_MODEL_REGISTRY[propType] ?? null;
}

/**
 * "Big" variants use the base model with a scale multiplier.
 * This maps big prop types to their base type + scale.
 */
export const BIG_VARIANT_MAP: Partial<
  Record<PropType, { base: PropType; scale: number }>
> = {
  [PropType.BIGSTAFF]: { base: PropType.STAFF, scale: 1.4 },
  [PropType.BIGCLUB]: { base: PropType.CLUB, scale: 1.4 },
  [PropType.BIGFAN]: { base: PropType.FAN, scale: 1.4 },
  [PropType.BIGTRIAD]: { base: PropType.TRIAD, scale: 1.4 },
  [PropType.BIGHOOP]: { base: PropType.MINIHOOP, scale: 1.4 },
  [PropType.BIGBUUGENG]: { base: PropType.BUUGENG, scale: 1.4 },
  [PropType.BIGCHICKEN]: { base: PropType.CHICKEN, scale: 1.4 },
  [PropType.BIGDOUBLESTAR]: { base: PropType.DOUBLESTAR, scale: 1.4 },
  [PropType.BIGEIGHTRINGS]: { base: PropType.EIGHTRINGS, scale: 1.4 },
  [PropType.BIGCONTACTBALL]: { base: PropType.CONTACTBALL, scale: 1.4 },
  [PropType.BIGDOUBLECONTACTBALL]: {
    base: PropType.DOUBLECONTACTBALL,
    scale: 1.4,
  },
  [PropType.BIGTORCH]: { base: PropType.TORCH, scale: 1.4 },
};

/**
 * Resolve a prop type to its model entry, handling big variants.
 * Returns the model entry and effective scale, or null if no model exists.
 */
export function resolvePropModel(
  propType: PropType
): { entry: PropModelEntry; scale: number } | null {
  // Check direct entry first
  const direct = getPropModel(propType);
  if (direct) return { entry: direct, scale: direct.scale };

  // Check big variant map
  const bigVariant = BIG_VARIANT_MAP[propType];
  if (bigVariant) {
    const baseEntry = getPropModel(bigVariant.base);
    if (baseEntry)
      return { entry: baseEntry, scale: baseEntry.scale * bigVariant.scale };
  }

  return null;
}
