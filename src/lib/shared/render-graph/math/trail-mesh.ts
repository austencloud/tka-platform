/**
 * Trail mesh math.
 *
 * Pure functions shared by backends that rasterize polygon-based trails.
 * Mirrors the visual pipeline in `Canvas2DTrailRenderer`: centripetal
 * Catmull-Rom spline smoothing, tapered polygon with per-vertex width,
 * exponential opacity fade toward the tail.
 *
 * Output is a triangle-strip mesh expressed as interleaved
 * (x, y, edge_t, alpha) floats:
 *   - position: NDC
 *   - edge_t: -1 at the left edge, +1 at the right edge
 *   - alpha: head→tail opacity falloff in 0..1
 *
 * The fragment shader consuming this mesh uses edge_t for anti-aliased
 * edge falloff and optional halo glow.
 */

export interface Point2D {
  x: number;
  y: number;
}

/** Must match Canvas2DTrailRenderer.FADE_EXPONENT to keep the fade curve identical. */
export const FADE_EXPONENT = 2.5;
/** Must match Canvas2DTrailRenderer.MIN_TAIL_WIDTH_RATIO. */
export const MIN_TAIL_WIDTH_RATIO = 0.3;
/** Target total spline subdivisions across a path — matches Canvas2D. */
export const TARGET_TOTAL_SUBDIVISIONS = 150;
export const MIN_SPLINE_SUBDIVISIONS = 2;
export const MAX_SPLINE_SUBDIVISIONS = 10;
const CATMULL_ROM_ALPHA = 0.5;

export interface SplineConfig {
  alpha: number;
  subdivisionsPerSegment: number;
}

export function createSmoothCurve(
  controlPoints: readonly Point2D[],
  config: Partial<SplineConfig> = {},
): Point2D[] {
  const alpha = config.alpha ?? CATMULL_ROM_ALPHA;
  const subdivisions = config.subdivisionsPerSegment ?? MAX_SPLINE_SUBDIVISIONS;

  if (controlPoints.length < 2) return controlPoints.map((p) => ({ ...p }));

  if (controlPoints.length === 2) {
    const p0 = controlPoints[0]!;
    const p1 = controlPoints[1]!;
    const out: Point2D[] = [];
    for (let i = 0; i <= subdivisions; i += 1) {
      const t = i / subdivisions;
      out.push({ x: p0.x + (p1.x - p0.x) * t, y: p0.y + (p1.y - p0.y) * t });
    }
    return out;
  }

  const result: Point2D[] = [{ x: controlPoints[0]!.x, y: controlPoints[0]!.y }];

  for (let i = 0; i < controlPoints.length - 1; i += 1) {
    const p0 = i > 0 ? controlPoints[i - 1]! : controlPoints[i]!;
    const p1 = controlPoints[i]!;
    const p2 = controlPoints[i + 1]!;
    const p3 = i < controlPoints.length - 2 ? controlPoints[i + 2]! : controlPoints[i + 1]!;

    const EPS = 1e-6;
    const getT = (t: number, pa: Point2D, pb: Point2D): number => {
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dist = Math.hypot(dx, dy);
      return t + Math.max(EPS, Math.pow(dist, alpha));
    };

    const t0 = 0;
    const t1 = getT(t0, p0, p1);
    const t2 = getT(t1, p1, p2);
    const t3 = getT(t2, p2, p3);

    const safeDiv = (num: number, den: number): number => (den === 0 ? 0 : num / den);
    const lerp = (pa: Point2D, pb: Point2D, t: number): Point2D => {
      const ct = Math.max(0, Math.min(1, t));
      return { x: pa.x + (pb.x - pa.x) * ct, y: pa.y + (pb.y - pa.y) * ct };
    };

    for (let j = 1; j <= subdivisions; j += 1) {
      const t = t1 + (j / subdivisions) * (t2 - t1);
      const a1 = lerp(p0, p1, safeDiv(t - t0, t1 - t0));
      const a2 = lerp(p1, p2, safeDiv(t - t1, t2 - t1));
      const a3 = lerp(p2, p3, safeDiv(t - t2, t3 - t2));
      const b1 = lerp(a1, a2, safeDiv(t - t0, t2 - t0));
      const b2 = lerp(a2, a3, safeDiv(t - t1, t3 - t1));
      result.push(lerp(b1, b2, safeDiv(t - t1, t2 - t1)));
    }
  }

  return result;
}

export function adaptiveSubdivisions(pointCount: number): number {
  if (pointCount <= 0) return MIN_SPLINE_SUBDIVISIONS;
  return Math.max(
    MIN_SPLINE_SUBDIVISIONS,
    Math.min(MAX_SPLINE_SUBDIVISIONS, Math.floor(TARGET_TOTAL_SUBDIVISIONS / pointCount)),
  );
}

export interface TrailMesh {
  /** Interleaved float buffer: [x0, y0, edge_t0, alpha0, x1, y1, edge_t1, alpha1, ...]. */
  vertices: Float32Array;
  /** Vertex count. Draw with gl.TRIANGLE_STRIP. */
  vertexCount: number;
}

export interface MeshBuildOptions {
  /** Head thickness in NDC — the polygon width at the head. */
  thickness: number;
  /** Tail thickness as a fraction of head. Matches Canvas2D MIN_TAIL_WIDTH_RATIO. */
  taperTailRatio?: number;
  /** Max opacity at the head, 0..1. */
  maxAlpha?: number;
  /** Exponent for head→tail fade. Matches Canvas2D FADE_EXPONENT. */
  fadeExponent?: number;
}

const EMPTY_MESH: TrailMesh = {
  vertices: new Float32Array(0),
  vertexCount: 0,
};

/**
 * Build a tapered triangle-strip mesh from a smoothed path.
 *
 * Path order is oldest-first: path[0] is the tail, path[length-1] is
 * the head (the current tip position). This matches the upstream ring
 * buffer convention in TrailOverlayCanvas.
 */
export function buildTaperedMesh(
  smoothPath: readonly Point2D[],
  options: MeshBuildOptions,
): TrailMesh {
  if (smoothPath.length < 2) return EMPTY_MESH;

  const thickness = options.thickness;
  const taperTailRatio = options.taperTailRatio ?? MIN_TAIL_WIDTH_RATIO;
  const maxAlpha = options.maxAlpha ?? 1;
  const fadeExponent = options.fadeExponent ?? FADE_EXPONENT;

  const n = smoothPath.length;
  const vertices = new Float32Array(n * 2 * 4);
  let offset = 0;

  for (let i = 0; i < n; i += 1) {
    const curr = smoothPath[i]!;
    const progress = i / (n - 1); // 0 at tail, 1 at head

    // Perpendicular from path tangent.
    let dx: number;
    let dy: number;
    if (i === 0) {
      const next = smoothPath[1]!;
      dx = next.x - curr.x;
      dy = next.y - curr.y;
    } else if (i === n - 1) {
      const prev = smoothPath[n - 2]!;
      dx = curr.x - prev.x;
      dy = curr.y - prev.y;
    } else {
      const prev = smoothPath[i - 1]!;
      const next = smoothPath[i + 1]!;
      dx = next.x - prev.x;
      dy = next.y - prev.y;
    }
    const len = Math.hypot(dx, dy) || 1;
    const perpX = -dy / len;
    const perpY = dx / len;

    // Width at this progress: linear ramp from taperTailRatio*thickness to thickness.
    const widthAtPoint = thickness * (taperTailRatio + (1 - taperTailRatio) * progress);
    const halfAtPoint = widthAtPoint * 0.5;

    // Opacity: matches Canvas2D FADE mode curve, mapped onto position.
    // raw progress = 1 - progress means 0 at head, 1 at tail for fade input.
    const fadeInput = 1 - progress;
    const fadeOutput = Math.pow(fadeInput, fadeExponent);
    const alpha = Math.max(0, Math.min(maxAlpha, maxAlpha * (1 - fadeOutput)));

    const leftX = curr.x + perpX * halfAtPoint;
    const leftY = curr.y + perpY * halfAtPoint;
    const rightX = curr.x - perpX * halfAtPoint;
    const rightY = curr.y - perpY * halfAtPoint;

    // Left edge: edge_t = -1
    vertices[offset + 0] = leftX;
    vertices[offset + 1] = leftY;
    vertices[offset + 2] = -1;
    vertices[offset + 3] = alpha;
    // Right edge: edge_t = +1
    vertices[offset + 4] = rightX;
    vertices[offset + 5] = rightY;
    vertices[offset + 6] = 1;
    vertices[offset + 7] = alpha;

    offset += 8;
  }

  return { vertices, vertexCount: n * 2, coreRatio };
}
