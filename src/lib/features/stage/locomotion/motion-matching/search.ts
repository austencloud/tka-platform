import { FEATURE_STRIDE, type MotionDatabase } from "./feature-types";

export interface MotionSearchConstraints {
  /** Clip families admitted by the intent/chooser layer. */
  allowedClipIds?: ReadonlySet<string> | readonly string[];
  /** Reject frames whose feet reverse the lateral ordering of their thighs.
   *  Zero allows a foot-to-foot closure; a positive value reserves clearance. */
  minimumLegOrderMargin?: number;
}

function allowsClip(
  allowed: ReadonlySet<string> | readonly string[] | undefined,
  clipId: string
): boolean {
  if (!allowed) return true;
  return Array.isArray(allowed)
    ? allowed.includes(clipId)
    : (allowed as ReadonlySet<string>).has(clipId);
}

/**
 * Weighted squared-L2 nearest-neighbour over the database. Returns the frame
 * index of the closest row. Flat linear scan — the DB is small (thousands of
 * rows x 24 floats), trivially real-time.
 */
export function searchNearest(
  db: MotionDatabase,
  query: Float32Array,
  constraints: MotionSearchConstraints = {}
): number {
  const { features, columnWeights } = db;
  const rowCount = features.length / FEATURE_STRIDE;
  let best = -1;
  let bestDist = Infinity;
  for (let r = 0; r < rowCount; r++) {
    const frame = db.frames[r];
    if (!frame || !allowsClip(constraints.allowedClipIds, frame.clipId)) {
      continue;
    }
    if (
      constraints.minimumLegOrderMargin !== undefined &&
      frame.quality &&
      frame.quality.legOrderMargin < constraints.minimumLegOrderMargin
    ) {
      continue;
    }
    const base = r * FEATURE_STRIDE;
    let dist = 0;
    for (let c = 0; c < FEATURE_STRIDE; c++) {
      const d = features[base + c]! - query[c]!;
      dist += columnWeights[c]! * d * d;
      if (dist >= bestDist) break; // early-out
    }
    if (dist < bestDist) {
      bestDist = dist;
      best = r;
    }
  }
  return best;
}
