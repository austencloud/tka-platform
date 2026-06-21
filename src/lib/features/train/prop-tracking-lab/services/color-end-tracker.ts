/**
 * ColorEndTracker — single-color LED-staff blob tracker.
 *
 * Capture method: each staff is a solid LED color (one color per staff). Per
 * frame, we find the staff's color blob, locate its two ends via PCA, and label
 * thumb vs pinky by continuity (the thumb end is the one nearest where the thumb
 * was last frame). Replaces the retired ArUco-marker approach.
 *
 * Verified by synthetic ImageData tests — draw a colored line, assert endpoints.
 */

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
}

export interface EndpointPair {
  thumb: PixelPoint;
  pinky: PixelPoint;
  confidence: number;
}

/** A pixel matches when its Euclidean RGB distance to the target is within tolerance. */
function colorMatches(r: number, g: number, b: number, target: ColorTarget): boolean {
  const dr = r - target.r;
  const dg = g - target.g;
  const db = b - target.b;
  return dr * dr + dg * dg + db * db <= target.tolerance * target.tolerance;
}

/**
 * Find the two ends of a single-color blob via PCA over matching pixels.
 * Returns null when fewer than `minPixels` pixels match (blob lost).
 */
export function findColorBlobEndpoints(
  frame: ImageData,
  target: ColorTarget,
  minPixels = 8,
): BlobResult | null {
  const { data, width, height } = frame;

  // 1. Collect matching pixel coordinates.
  const xs: number[] = [];
  const ys: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (colorMatches(data[i]!, data[i + 1]!, data[i + 2]!, target)) {
        xs.push(x);
        ys.push(y);
      }
    }
  }

  const count = xs.length;
  if (count < minPixels) return null;

  // 2. Centroid.
  let sumX = 0;
  let sumY = 0;
  for (let k = 0; k < count; k++) {
    sumX += xs[k]!;
    sumY += ys[k]!;
  }
  const cx = sumX / count;
  const cy = sumY / count;

  // 3. Covariance.
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let k = 0; k < count; k++) {
    const dx = xs[k]! - cx;
    const dy = ys[k]! - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  sxx /= count;
  syy /= count;
  sxy /= count;

  // 4. Larger eigenvalue.
  const halfTrace = (sxx + syy) / 2;
  const halfDiff = (sxx - syy) / 2;
  const lambda = halfTrace + Math.sqrt(halfDiff * halfDiff + sxy * sxy);

  // 5. Principal axis eigenvector.
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

  // 6. Project each matching pixel; endpoints are the min-t and max-t pixels.
  let minT = Infinity;
  let maxT = -Infinity;
  let minEnd: PixelPoint = { x: xs[0]!, y: ys[0]! };
  let maxEnd: PixelPoint = { x: xs[0]!, y: ys[0]! };
  for (let k = 0; k < count; k++) {
    const t = (xs[k]! - cx) * vx + (ys[k]! - cy) * vy;
    if (t < minT) {
      minT = t;
      minEnd = { x: xs[k]!, y: ys[k]! };
    }
    if (t > maxT) {
      maxT = t;
      maxEnd = { x: xs[k]!, y: ys[k]! };
    }
  }

  // 7. Confidence proxy (fullness).
  const confidence = Math.min(1, count / 400);

  return {
    endpoints: [minEnd, maxEnd],
    centroid: { x: cx, y: cy },
    confidence,
  };
}

function distance(a: PixelPoint, b: PixelPoint): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Label two endpoints as thumb/pinky by continuity.
 * With no previous thumb, thumb defaults to `a` (caller calibrates).
 * Otherwise thumb is whichever endpoint is nearer to `prevThumb`.
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
 * Stateful tracker that composes blob detection with thumb continuity across
 * frames. Holds the previous thumb position internally.
 */
export class ColorEndTracker {
  private prevThumb: PixelPoint | null = null;

  track(frame: ImageData, target: ColorTarget): EndpointPair | null {
    const blob = findColorBlobEndpoints(frame, target);
    // Blob lost: keep prevThumb so we can re-acquire the same label on return.
    if (blob === null) return null;

    const { thumb, pinky } = assignThumbPinky(
      blob.endpoints[0],
      blob.endpoints[1],
      this.prevThumb,
    );
    this.prevThumb = thumb;
    return { thumb, pinky, confidence: blob.confidence };
  }

  reset(): void {
    this.prevThumb = null;
  }
}
