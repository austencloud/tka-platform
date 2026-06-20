// src/lib/features/stage/locomotion/dodge/inside-gamma-target.ts

import type { SimPropTarget } from "$lib/features/lab/tabs/collision-lab/services/types";
import type { StancePose } from "$lib/features/lab/tabs/collision-lab/domain/types";

/**
 * Inside-gamma stance target.
 *
 * The optimizer finds *a* clearing stance but has no preference for WHERE the
 * performer stands or which way they face — so it grabs whichever feasible
 * basin its descent lands in, often the obtuse OUTSIDE of the gamma right
 * angle, or a worse-than-necessary cross-body reach. The performer's correct
 * home is the acute INSIDE corner.
 *
 * Empirically (grid search of the alpha-A preset against the swept volume), the
 * feasible inside corner is NOT backed off to the equidistant reach apex — that
 * over-distances the hands from the swept grips and breaks reach. It is right
 * AMONG the grips: the body stands at the grips' centroid (close enough to keep
 * both hands glued through the whole sweep, off both staff lines) and faces the
 * gamma vertex (where the two staff lines cross) so the props sit out to either
 * side at ~90°. That is exactly "inside gamma, facing the corner."
 *
 * Frame: the StanceSimulator's shoulder-centered world (Y up, +Z = the
 * performer's forward at yaw 0). Body forward at yaw θ is (sin θ, cos θ), so a
 * facing toward direction (dx, dz) is atan2(dx, dz).
 */

interface XZ {
  x: number;
  z: number;
}

function centroid(sweep: SimPropTarget[]): XZ {
  let x = 0;
  let z = 0;
  for (const s of sweep) {
    x += s.gripWorld.x;
    z += s.gripWorld.z;
  }
  const n = sweep.length || 1;
  return { x: x / n, z: z / n };
}

/** Shaft direction (XZ, unit) at the middle of a sweep. Sign-agnostic — only the
 *  line orientation matters for the vertex intersection. */
function midAxis(sweep: SimPropTarget[]): XZ {
  const i = Math.floor(sweep.length / 2);
  const s = sweep[i] ?? sweep[0];
  if (!s) return { x: 1, z: 0 };
  const dx = s.tipAWorld.x - s.gripWorld.x;
  const dz = s.tipAWorld.z - s.gripWorld.z;
  const len = Math.hypot(dx, dz) || 1;
  return { x: dx / len, z: dz / len };
}

/** Intersect two lines (point + unit dir) in XZ. Null when near-parallel. */
function intersectLines(p1: XZ, d1: XZ, p2: XZ, d2: XZ): XZ | null {
  const denom = d1.x * d2.z - d1.z * d2.x;
  if (Math.abs(denom) < 1e-4) return null;
  const t = ((p2.x - p1.x) * d2.z - (p2.z - p1.z) * d2.x) / denom;
  return { x: p1.x + t * d1.x, z: p1.z + t * d1.z };
}

/** Facing yaw (rad) that points the body forward toward direction (dx, dz). */
function yawFacing(dx: number, dz: number): number {
  if (Math.hypot(dx, dz) < 1e-6) return 0;
  return Math.atan2(dx, dz);
}

export interface InsideGammaTarget {
  /** The biased stance: stand at the grips' centroid, face the gamma vertex. */
  stance: StancePose;
  /** Intersection of the two staff lines (the gamma vertex), or null when the
   *  shafts are parallel and no single crossing point exists. */
  vertex: XZ | null;
  /** Centroid of every grip across both sweeps — the stand point. */
  gripsCentroid: XZ;
}

/**
 * Derive the inside-gamma stance target from both hands' swept grips.
 *
 * Stand point = the centroid of all grips (close to both hands, off both staff
 * lines). Facing = toward the gamma vertex so the two props sit out to the
 * sides. When the shafts are parallel (no vertex), face along the perpendicular
 * of the grip chord toward the grips so the body still squares up to them.
 */
export function computeInsideGammaTarget(
  blueSweep: SimPropTarget[],
  redSweep: SimPropTarget[]
): InsideGammaTarget {
  const cb = centroid(blueSweep);
  const cr = centroid(redSweep);
  const nb = blueSweep.length;
  const nr = redSweep.length;
  const gripsCentroid: XZ = {
    x: (cb.x * nb + cr.x * nr) / (nb + nr || 1),
    z: (cb.z * nb + cr.z * nr) / (nb + nr || 1),
  };

  const vertex = intersectLines(cb, midAxis(blueSweep), cr, midAxis(redSweep));

  let facing: number;
  if (vertex) {
    facing = yawFacing(vertex.x - gripsCentroid.x, vertex.z - gripsCentroid.z);
  } else {
    // Parallel shafts: face perpendicular to the grip chord, toward the side the
    // grips lean (fallback — square up to the line of grips).
    const chordX = cr.x - cb.x;
    const chordZ = cr.z - cb.z;
    facing = yawFacing(chordZ, -chordX);
  }

  return {
    stance: {
      footOffsetX: gripsCentroid.x,
      footOffsetZ: gripsCentroid.z,
      rootYawRad: facing,
      spinePitchRad: 0,
    },
    vertex,
    gripsCentroid,
  };
}
