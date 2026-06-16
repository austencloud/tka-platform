import { FEATURE_STRIDE, type MotionDatabase } from "./feature-types";

/**
 * Weighted squared-L2 nearest-neighbour over the database. Returns the frame
 * index of the closest row. Flat linear scan — the DB is small (thousands of
 * rows x 24 floats), trivially real-time.
 */
export function searchNearest(db: MotionDatabase, query: Float32Array): number {
  const { features, columnWeights } = db;
  const rowCount = features.length / FEATURE_STRIDE;
  let best = -1;
  let bestDist = Infinity;
  for (let r = 0; r < rowCount; r++) {
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
