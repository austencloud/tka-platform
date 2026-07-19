import { calculate as calculateMandalaGeometry } from "$lib/shared/mandala/services/mandala-geometry-calculator";
import { applyVariationDescriptor } from "$lib/features/choreo-card/services/deck-variation";
import { Orientation } from "$lib/shared/pictograph/shared/domain/enums/pictograph-enums";
import type { CsvEdge } from "$lib/features/choreo-card/services/pictograph-letter-lookup";
import type { SVGPathData } from "$lib/shared/mandala/domain/mandala-types";
import type { SequenceData } from "$lib/shared/foundation/domain/models/sequence-data";
import { flowerTurnPattern, type Flower } from "../domain/flower-signature";

/**
 * Geometric parity check between a cell's overlay mandala and a mode's
 * realization. The overlay is a canonical blue-hand locus (south-anchored) for
 * each flower; a real two-hand realization starts its hands at the base word's
 * own grid positions, so a hand can trace the RIGHT flower at the WRONG rotation
 * (Austen: "rotated variations of the red pathway due to the orientation we
 * started"). The fix is per-hand start orientation. This module measures the
 * mismatch and SEARCHES the orientation space for the pair that reproduces the
 * overlay — pure geometry (calculateMandalaGeometry has no DOM/auth dep), so it
 * runs headlessly and self-corrects each card instead of hand-marking.
 */

interface Pt {
  x: number;
  y: number;
}

/** Candidate start orientations: 0°/180° (in/out) + ∓90° (clock/counter) cover
 *  the cardinal-anchor rotations a diamond realization can be off by. */
const ORI_CANDIDATES: Orientation[] = [
  Orientation.IN,
  Orientation.OUT,
  Orientation.CLOCK,
  Orientation.COUNTER,
];

/** Two loci within this many mandala-space px are the same shape+rotation. */
export const MATCH_EPS = 2.0;

/**
 * On-curve tip points of a mandala path set. `pointsToSVGPath` emits
 * `M x0 y0 C _ _ _ _ x1 y1 C …` — the sampled points are the M point plus each
 * cubic's endpoint (the last pair of every 6-number C group).
 */
export function pathPoints(paths: SVGPathData[]): Pt[] {
  const pts: Pt[] = [];
  for (const p of paths) {
    // tolerate exponent form (e.g. 6.12e-15) so a non-toFixed producer can't
    // split one coordinate into two tokens and shift the whole parse.
    const nums = (p.d.match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) ?? []).map(Number);
    if (nums.length < 2) continue;
    pts.push({ x: nums[0]!, y: nums[1]! });
    for (let i = 2; i + 6 <= nums.length; i += 6) {
      pts.push({ x: nums[i + 4]!, y: nums[i + 5]! });
    }
  }
  return pts;
}

/**
 * Distance between two CLOSED loops: min over cyclic phase shift and traversal
 * reversal of the worst per-point gap. Invariant to where sampling starts and to
 * traversal direction (both trace the same locus) but NOT to spatial rotation —
 * a rotated copy scores far above MATCH_EPS, which is exactly the defect we want
 * to catch. Returns Infinity for empty or unequal-length loops.
 */
export function loopDistance(a: Pt[], b: Pt[]): number {
  if (!a.length || !b.length || a.length !== b.length) return Infinity;
  const n = a.length;
  let best = Infinity;
  for (const bv of [b, [...b].reverse()]) {
    for (let s = 0; s < n; s++) {
      let mx = 0;
      for (let i = 0; i < n && mx < best; i++) {
        const p = a[i]!;
        const q = bv[(i + s) % n]!;
        const d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d > mx) mx = d;
      }
      if (mx < best) best = mx;
    }
  }
  return best;
}

function gridModeOf(pair: { blue: Flower; red: Flower }): "diamond" | "box" {
  // One pictograph = one grid mode; a mixed-grid off-diagonal cell has no single
  // realizable pictograph, so render it in diamond (matches build-realization-cards).
  return pair.blue.grid === pair.red.grid ? pair.blue.grid : "diamond";
}

/** Build a realization at a candidate orientation pair and compute its loci. */
function realize(
  base: SequenceData,
  pair: { blue: Flower; red: Flower },
  blueOri: Orientation,
  redOri: Orientation,
  edges: CsvEdge[],
  clubTipDx: number,
): { sequence: SequenceData; blue: SVGPathData[]; red: SVGPathData[] } {
  const blueTurn = flowerTurnPattern(pair.blue).split("|")[0];
  const redTurn = flowerTurnPattern(pair.red).split("|")[0];
  const { sequence } = applyVariationDescriptor(
    base,
    {
      turnPattern: `${blueTurn}|${redTurn}`,
      turnLabel: "verify",
      gridMode: gridModeOf(pair),
      startOriPair: { blue: blueOri, red: redOri },
    },
    edges,
  );
  const paths = calculateMandalaGeometry(
    sequence.steps,
    undefined,
    undefined,
    { tipEnds: 1, pathShape: "arc" },
    { dx: clubTipDx, dy: 0 },
  );
  return { sequence, blue: paths.blue, red: paths.red };
}

export interface ParityResult {
  /** Orientation chosen for each hand to best reproduce the overlay. */
  blueOri: Orientation;
  redOri: Orientation;
  /** Loop distance of each corrected hand to the overlay (≤ MATCH_EPS = exact). */
  blueDist: number;
  redDist: number;
  /** Both hands reproduce the overlay within tolerance. */
  matched: boolean;
  /** The corrected realization sequence (use this for the card + animation). */
  sequence: SequenceData;
}

/**
 * Find the per-hand start orientation that makes a mode's realization reproduce
 * the cell overlay, and return the corrected sequence + a parity verdict. A
 * hand's locus depends only on its own start orientation, so the two hands are
 * searched independently (4 + 4 builds, not 16). When no orientation reaches
 * MATCH_EPS the closest is returned with `matched = false` so the UI can flag it
 * rather than silently show a wrong card.
 */
export function verifyAndCorrect(
  base: SequenceData,
  pair: { blue: Flower; red: Flower },
  overlayBlue: SVGPathData[],
  overlayRed: SVGPathData[],
  edges: CsvEdge[],
  clubTipDx: number,
): ParityResult {
  const ob = pathPoints(overlayBlue);
  const or = pathPoints(overlayRed);
  const defBlue = pair.blue.ori as Orientation;
  const defRed = pair.red.ori as Orientation;

  let bestBlue = defBlue;
  let blueDist = Infinity;
  for (const o of ORI_CANDIDATES) {
    const d = loopDistance(ob, pathPoints(realize(base, pair, o, defRed, edges, clubTipDx).blue));
    if (d < blueDist) {
      blueDist = d;
      bestBlue = o;
    }
  }

  let bestRed = defRed;
  let redDist = Infinity;
  for (const o of ORI_CANDIDATES) {
    const d = loopDistance(or, pathPoints(realize(base, pair, bestBlue, o, edges, clubTipDx).red));
    if (d < redDist) {
      redDist = d;
      bestRed = o;
    }
  }

  const final = realize(base, pair, bestBlue, bestRed, edges, clubTipDx);
  return {
    blueOri: bestBlue,
    redOri: bestRed,
    blueDist,
    redDist,
    matched: blueDist <= MATCH_EPS && redDist <= MATCH_EPS,
    sequence: final.sequence,
  };
}
