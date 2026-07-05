/**
 * ColorEndTracker — single-color LED-staff blob tracker.
 *
 * Capture method: each staff is a solid LED color (one color per staff). Per
 * frame, we find the staff's color blob, locate its two ends via PCA, and label
 * thumb vs pinky by continuity. Replaces the retired ArUco-marker approach.
 *
 * Hardened for real footage (2026-07-05):
 * - Connected-component labeling (8-connectivity, same iterative flood-fill
 *   pattern as video-trails/services/led-threshold-detector.ts) so background
 *   speckle, reflections, and clutter of the same color can't corrupt the PCA.
 *   The staff = the largest component; competing mass lowers blob confidence.
 * - Predictive thumb/pinky correspondence: constant-velocity prediction per
 *   endpoint + exact minimum-cost assignment over the two label hypotheses
 *   (the 2x2 case of the Hungarian algorithm, solved by direct comparison —
 *   a general solver or npm package would be dead weight for n=2). Survives
 *   fast spin and coasts through dropouts, where nearest-to-previous aliases.
 * - Foreshortening detection: the projected axis length vs its rolling max.
 *   A staff tilting toward the camera shrinks in projection; orientation
 *   becomes unreadable in a single view, so confidence must say so instead of
 *   silently emitting Orientation.OUT.
 *
 * Verified by synthetic ImageData tests, including degradation tests that
 * approximate real-video pathologies (speckle, reflections, dropped frames,
 * fast rotation). NOT yet validated on real captured video.
 */

import type { TrackConfidence } from '../domain/notation-3d';

export interface PixelPoint {
  x: number;
  y: number;
}

export interface ColorTarget {
  r: number;
  g: number;
  b: number;
  tolerance: number;
}

export interface BlobResult {
  /** endpoints[0] = min-projection end, endpoints[1] = max-projection end (deterministic). */
  endpoints: [PixelPoint, PixelPoint];
  centroid: PixelPoint;
  confidence: number;
  /** Pixel count of the winning (largest) connected component. */
  mass: number;
  /** Second-largest component's mass / winner's mass. 0 = no competitor. */
  secondaryMassRatio: number;
  /** Distance in pixels between the two endpoints (projected staff length). */
  axisLengthPx: number;
}

export interface EndpointPair {
  thumb: PixelPoint;
  pinky: PixelPoint;
  confidence: number;
  /** Per-failure-mode breakdown of `confidence` (which is the min of these). */
  detail: TrackConfidence;
}

export interface TrackerConfig {
  /** Largest component must have at least this many pixels; below = blob lost. */
  minPixels: number;
  /** Components below this size are ignored entirely (speckle noise). */
  speckMinPixels: number;
  /**
   * Max frames to coast the constant-velocity prediction through a dropout.
   * Past this the velocity is stale; we fall back to nearest-to-previous and
   * report correspondence confidence 0 (the label needs re-verification).
   */
  maxCoastFrames: number;
}

export const DEFAULT_TRACKER_CONFIG: TrackerConfig = {
  minPixels: 8,
  speckMinPixels: 4,
  maxCoastFrames: 6,
};

/** A pixel matches when its Euclidean RGB distance to the target is within tolerance. */
function colorMatches(r: number, g: number, b: number, target: ColorTarget): boolean {
  const dr = r - target.r;
  const dg = g - target.g;
  const db = b - target.b;
  return dr * dr + dg * dg + db * db <= target.tolerance * target.tolerance;
}

/**
 * Find the two ends of the staff's color blob.
 *
 * Threshold -> connected components (8-connectivity) -> keep the largest
 * component -> PCA over its pixels -> min/max-projection endpoints. Returns
 * null when the largest component has fewer than `minPixels` pixels.
 */
export function findColorBlobEndpoints(
  frame: ImageData,
  target: ColorTarget,
  minPixels = DEFAULT_TRACKER_CONFIG.minPixels,
  speckMinPixels = DEFAULT_TRACKER_CONFIG.speckMinPixels,
): BlobResult | null {
  const { data, width, height } = frame;

  // 1. Threshold pass: mark matching pixels in a mask and list their indices.
  //    mask: 0 = no match, 1 = match (unvisited), 2 = visited by flood fill.
  const mask = new Uint8Array(width * height);
  const matched: number[] = [];
  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const i = (row + x) * 4;
      if (colorMatches(data[i]!, data[i + 1]!, data[i + 2]!, target)) {
        mask[row + x] = 1;
        matched.push(row + x);
      }
    }
  }
  if (matched.length < minPixels) return null;

  // 2. Connected components via iterative flood fill over the mask. We only
  //    keep the pixel list of the current best component; the rest just
  //    contribute their mass so we can report how much competition there was.
  let bestPixels: number[] = [];
  let secondMass = 0;
  const stack: number[] = [];
  for (const seed of matched) {
    if (mask[seed] !== 1) continue;
    mask[seed] = 2;
    stack.length = 0;
    stack.push(seed);
    const component: number[] = [];
    while (stack.length > 0) {
      const idx = stack.pop()!;
      component.push(idx);
      const cx = idx % width;
      const cy = (idx - cx) / width;
      for (let dy = -1; dy <= 1; dy++) {
        const ny = cy + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = cx + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] === 1) {
            mask[nIdx] = 2;
            stack.push(nIdx);
          }
        }
      }
    }
    if (component.length < speckMinPixels) continue; // speckle — ignore
    if (component.length > bestPixels.length) {
      secondMass = Math.max(secondMass, bestPixels.length);
      bestPixels = component;
    } else {
      secondMass = Math.max(secondMass, component.length);
    }
  }

  const count = bestPixels.length;
  if (count < minPixels) return null;

  // 3. Centroid of the winning component.
  let sumX = 0;
  let sumY = 0;
  for (let k = 0; k < count; k++) {
    const idx = bestPixels[k]!;
    sumX += idx % width;
    sumY += (idx - (idx % width)) / width;
  }
  const cx = sumX / count;
  const cy = sumY / count;

  // 4. Covariance.
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let k = 0; k < count; k++) {
    const idx = bestPixels[k]!;
    const dx = (idx % width) - cx;
    const dy = (idx - (idx % width)) / width - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= count;
  syy /= count;
  sxy /= count;

  // 5. Larger eigenvalue + principal-axis eigenvector.
  const halfTrace = (sxx + syy) / 2;
  const halfDiff = (sxx - syy) / 2;
  const lambda = halfTrace + Math.sqrt(halfDiff * halfDiff + sxy * sxy);

  let vx: number;
  let vy: number;
  if (Math.abs(sxy) > 1e-9) {
    vx = lambda - syy;
    vy = sxy;
    const len = Math.hypot(vx, vy);
    vx /= len;
    vy /= len;
  } else if (sxx >= syy) {
    vx = 1;
    vy = 0;
  } else {
    vx = 0;
    vy = 1;
  }

  // 6. Project each component pixel onto the principal axis. Endpoints are
  //    the centroids of the pixels within CAP_DEPTH of the extreme
  //    projections — a single extreme pixel is a corner of the blob's end cap
  //    and jitters with quantization; the cap centroid is stable.
  let minT = Infinity;
  let maxT = -Infinity;
  for (let k = 0; k < count; k++) {
    const idx = bestPixels[k]!;
    const px = idx % width;
    const py = (idx - px) / width;
    const t = (px - cx) * vx + (py - cy) * vy;
    if (t < minT) minT = t;
    if (t > maxT) maxT = t;
  }
  const CAP_DEPTH = 1.5;
  let minSx = 0;
  let minSy = 0;
  let minN = 0;
  let maxSx = 0;
  let maxSy = 0;
  let maxN = 0;
  for (let k = 0; k < count; k++) {
    const idx = bestPixels[k]!;
    const px = idx % width;
    const py = (idx - px) / width;
    const t = (px - cx) * vx + (py - cy) * vy;
    if (t <= minT + CAP_DEPTH) {
      minSx += px;
      minSy += py;
      minN++;
    }
    if (t >= maxT - CAP_DEPTH) {
      maxSx += px;
      maxSy += py;
      maxN++;
    }
  }
  const minEnd: PixelPoint = { x: minSx / minN, y: minSy / minN };
  const maxEnd: PixelPoint = { x: maxSx / maxN, y: maxSy / maxN };

  // 7. Confidence: fullness of the winning blob, penalized by how much
  //    same-color competition existed (reflections split trust in half when
  //    the runner-up is as big as the winner).
  const fullness = Math.min(1, count / 400);
  const secondaryMassRatio = count > 0 ? secondMass / count : 0;
  const confidence = fullness * (1 - 0.5 * Math.min(1, secondaryMassRatio));

  return {
    endpoints: [minEnd, maxEnd],
    centroid: { x: cx, y: cy },
    confidence,
    mass: count,
    secondaryMassRatio,
    axisLengthPx: Math.hypot(maxEnd.x - minEnd.x, maxEnd.y - minEnd.y),
  };
}

function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Label two endpoints as thumb/pinky by plain continuity (nearest to previous
 * thumb). Kept as the stateless building block; the stateful tracker below
 * uses velocity prediction on top of this idea. With no previous thumb, thumb
 * defaults to `a` (caller calibrates).
 */
export function assignThumbPinky(
  a: PixelPoint,
  b: PixelPoint,
  prevThumb: PixelPoint | null,
): { thumb: PixelPoint; pinky: PixelPoint } {
  if (prevThumb === null) {
    return { thumb: a, pinky: b };
  }
  return distance(a, prevThumb) <= distance(b, prevThumb)
    ? { thumb: a, pinky: b }
    : { thumb: b, pinky: a };
}

/**
 * Stateful tracker composing blob detection with predictive thumb/pinky
 * correspondence and foreshortening detection across frames.
 *
 * Correspondence: each endpoint's position is predicted one step ahead with
 * constant velocity (coasting multiple steps through dropouts, capped at
 * `maxCoastFrames`). The two label hypotheses — (thumb,pinky)=(e0,e1) or
 * (e1,e0) — are costed against the predictions and the cheaper one wins.
 * That is the exact solution of the 2x2 assignment problem; no general
 * Hungarian solver needed. The margin between the two hypothesis costs,
 * normalized by staff length, becomes the correspondence confidence: when the
 * margin is thin the assignment was a coin flip and downstream must know.
 */
export class ColorEndTracker {
  private prevThumb: PixelPoint | null = null;
  private prevPinky: PixelPoint | null = null;
  private velThumb: PixelPoint = { x: 0, y: 0 };
  private velPinky: PixelPoint = { x: 0, y: 0 };
  /** Frames elapsed since the blob was last seen (0 = seen last frame). */
  private framesSinceSeen = 0;
  /** Rolling max of the projected staff length, decayed slightly per frame. */
  private rollingAxisMax = 0;

  constructor(private config: TrackerConfig = DEFAULT_TRACKER_CONFIG) {}

  track(frame: ImageData, target: ColorTarget): EndpointPair | null {
    const blob = findColorBlobEndpoints(
      frame,
      target,
      this.config.minPixels,
      this.config.speckMinPixels,
    );
    if (blob === null) {
      // Blob lost: remember how long, keep state to re-acquire the label.
      this.framesSinceSeen++;
      return null;
    }

    const gap = this.framesSinceSeen + 1; // frames since the last good sample
    const [e0, e1] = blob.endpoints;

    let thumb: PixelPoint;
    let pinky: PixelPoint;
    let correspondence: number;

    if (this.prevThumb === null || this.prevPinky === null) {
      // First sighting: deterministic default (min-projection end = thumb).
      // The label is uncalibrated until the user confirms it, hence 0.5.
      thumb = e0;
      pinky = e1;
      correspondence = 0.5;
    } else if (gap > this.config.maxCoastFrames) {
      // Dropout too long to trust the velocity. Fall back to nearest-previous
      // and report the label as unverified.
      ({ thumb, pinky } = assignThumbPinky(e0, e1, this.prevThumb));
      correspondence = 0;
    } else {
      // Constant-velocity prediction, coasted over the dropout gap.
      const predThumb = {
        x: this.prevThumb.x + this.velThumb.x * gap,
        y: this.prevThumb.y + this.velThumb.y * gap,
      };
      const predPinky = {
        x: this.prevPinky.x + this.velPinky.x * gap,
        y: this.prevPinky.y + this.velPinky.y * gap,
      };
      // The two assignment hypotheses (2x2 Hungarian, solved directly).
      const costKeep = distance(e0, predThumb) + distance(e1, predPinky);
      const costSwap = distance(e1, predThumb) + distance(e0, predPinky);
      if (costKeep <= costSwap) {
        thumb = e0;
        pinky = e1;
      } else {
        thumb = e1;
        pinky = e0;
      }
      // Margin between hypotheses, normalized by staff length. A swap moves
      // each endpoint by up to one staff length, so a margin of half a staff
      // length is decisively unambiguous.
      const staffLen = Math.max(blob.axisLengthPx, 1);
      correspondence = Math.min(1, Math.abs(costKeep - costSwap) / (0.5 * staffLen));
    }

    // Velocity update (per-frame, averaged over the gap when frames dropped).
    if (this.prevThumb !== null && this.prevPinky !== null) {
      this.velThumb = {
        x: (thumb.x - this.prevThumb.x) / gap,
        y: (thumb.y - this.prevThumb.y) / gap,
      };
      this.velPinky = {
        x: (pinky.x - this.prevPinky.x) / gap,
        y: (pinky.y - this.prevPinky.y) / gap,
      };
    }
    this.prevThumb = thumb;
    this.prevPinky = pinky;
    this.framesSinceSeen = 0;

    // Foreshortening: projected axis length vs its (slightly decaying) rolling
    // max. Ratio 0.8+ = fully readable; 0.2- = staff pointing at the camera.
    this.rollingAxisMax = Math.max(this.rollingAxisMax * 0.995, blob.axisLengthPx);
    const ratio = this.rollingAxisMax > 0 ? blob.axisLengthPx / this.rollingAxisMax : 0;
    const orientation = Math.min(1, Math.max(0, (ratio - 0.2) / 0.6));

    const detail: TrackConfidence = {
      blob: blob.confidence,
      correspondence,
      orientation,
      overall: Math.min(blob.confidence, correspondence, orientation),
    };
    return { thumb, pinky, confidence: detail.overall, detail };
  }

  reset(): void {
    this.prevThumb = null;
    this.prevPinky = null;
    this.velThumb = { x: 0, y: 0 };
    this.velPinky = { x: 0, y: 0 };
    this.framesSinceSeen = 0;
    this.rollingAxisMax = 0;
  }
}
