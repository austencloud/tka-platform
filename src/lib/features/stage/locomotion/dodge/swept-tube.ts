import { Vector3 } from "three";
import type { SweepSample } from "./dodge-types";

export interface NearestApproach {
  /** Distance from the query point to the nearest staff shaft segment (m). */
  dist: number;
  /** The point on that segment closest to the query. */
  nearestPoint: Vector3;
  /** Index of the winning sample in the sweep. */
  sampleIndex: number;
}

const _ab = new Vector3();
const _ap = new Vector3();
const _closest = new Vector3();

/** Closest point to `p` on segment [a,b], written into `out`; returns t∈[0,1]. */
function closestOnSegment(p: Vector3, a: Vector3, b: Vector3, out: Vector3): number {
  _ab.copy(b).sub(a);
  _ap.copy(p).sub(a);
  const len2 = _ab.lengthSq();
  const t = len2 > 1e-12 ? Math.min(1, Math.max(0, _ap.dot(_ab) / len2)) : 0;
  out.copy(a).addScaledVector(_ab, t);
  return t;
}

/**
 * A prop's whole sweep as a union of staff shaft segments (one per sampled
 * instant). Provides closed-form distance from any point to the swept volume,
 * plus centroid + principal sweep axis for choosing the open vacate quadrant.
 * Pure; no Three.js scene-graph dependency.
 */
export class SweptTube {
  constructor(private readonly samples: SweepSample[]) {}

  /** Min distance from `point` to any staff segment, with the winning sample. */
  minDistanceToSegments(point: Vector3): NearestApproach {
    let best = Infinity;
    let bestIdx = 0;
    const nearest = new Vector3();
    for (let i = 0; i < this.samples.length; i++) {
      const s = this.samples[i]!;
      closestOnSegment(point, s.tipAWorld, s.tipBWorld, _closest);
      const d = point.distanceTo(_closest);
      if (d < best) {
        best = d;
        bestIdx = i;
        nearest.copy(_closest);
      }
    }
    return { dist: best, nearestPoint: nearest, sampleIndex: bestIdx };
  }

  /** Mean grip position across the sweep. */
  centroid(): Vector3 {
    const c = new Vector3();
    for (const s of this.samples) c.add(s.gripWorld);
    return this.samples.length ? c.multiplyScalar(1 / this.samples.length) : c;
  }

  /**
   * Dominant horizontal (XZ) travel direction of the grips, as a unit vector,
   * via the largest-spread axis of the grip cloud. Returns null when the grips
   * barely move (a static/coincident sweep has no meaningful sweep direction).
   */
  principalAxis(): Vector3 | null {
    const c = this.centroid();
    // 2x2 XZ covariance.
    let sxx = 0, sxz = 0, szz = 0;
    for (const s of this.samples) {
      const dx = s.gripWorld.x - c.x;
      const dz = s.gripWorld.z - c.z;
      sxx += dx * dx; sxz += dx * dz; szz += dz * dz;
    }
    const n = this.samples.length || 1;
    sxx /= n; sxz /= n; szz /= n;
    const spread = sxx + szz;
    if (spread < 1e-4) return null; // < 1 cm RMS travel → degenerate
    // Largest eigenvector of [[sxx,sxz],[sxz,szz]].
    const tr = sxx + szz;
    const det = sxx * szz - sxz * sxz;
    const lambda = tr / 2 + Math.sqrt(Math.max(0, (tr * tr) / 4 - det));
    const ex = Math.abs(sxz) > 1e-9 ? lambda - szz : 1;
    const ez = Math.abs(sxz) > 1e-9 ? sxz : 0;
    const v = new Vector3(ex, 0, ez);
    return v.lengthSq() > 1e-12 ? v.normalize() : null;
  }
}
