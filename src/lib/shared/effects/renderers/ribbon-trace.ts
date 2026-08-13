/**
 * Catmull-Rom spline tracers shared by the silk ribbon and the animal
 * creature renderers. Moved out of silk-2d-renderer so both consume one copy.
 */

/** Catmull-Rom spline forward through an edge array. Starts with moveTo. */
export function traceForward(
  ctx: CanvasRenderingContext2D,
  x: number[],
  y: number[],
  start: number,
  end: number,
  n: number
): void {
  ctx.moveTo(x[start]!, y[start]!);
  for (let i = start + 1; i <= end; i++) {
    const i0 = Math.max(0, i - 2);
    const i1 = i - 1;
    const i3 = Math.min(n - 1, i + 1);
    ctx.bezierCurveTo(
      x[i1]! + (x[i]! - x[i0]!) / 6,
      y[i1]! + (y[i]! - y[i0]!) / 6,
      x[i]! - (x[i3]! - x[i1]!) / 6,
      y[i]! - (y[i3]! - y[i1]!) / 6,
      x[i]!,
      y[i]!
    );
  }
}

/** Catmull-Rom spline backward through an edge array. Continues current path (no moveTo). */
export function traceBackward(
  ctx: CanvasRenderingContext2D,
  x: number[],
  y: number[],
  start: number,
  end: number,
  n: number
): void {
  ctx.lineTo(x[end]!, y[end]!);
  for (let i = end - 1; i >= start; i--) {
    const i0 = Math.min(n - 1, i + 2);
    const i1 = i + 1;
    const i3 = Math.max(0, i - 1);
    ctx.bezierCurveTo(
      x[i1]! + (x[i]! - x[i0]!) / 6,
      y[i1]! + (y[i]! - y[i0]!) / 6,
      x[i]! - (x[i3]! - x[i1]!) / 6,
      y[i]! - (y[i3]! - y[i1]!) / 6,
      x[i]!,
      y[i]!
    );
  }
}

export interface RibbonTracePoint {
  x: number;
  y: number;
}

export interface RibbonBezierSegment {
  control1: RibbonTracePoint;
  control2: RibbonTracePoint;
  end: RibbonTracePoint;
}

const MIN_KNOT_INTERVAL = 0.001;

/**
 * Unevenly spaced trail samples can make a uniform spline hook backward at a
 * tight turn. Centripetal timing shortens the handle beside a crowded sample,
 * so the visible edge follows the prop path without growing a tiny loop.
 */
export function resolveCentripetalBezierSegment(
  p0: RibbonTracePoint,
  p1: RibbonTracePoint,
  p2: RibbonTracePoint,
  p3: RibbonTracePoint
): RibbonBezierSegment {
  const t0 = 0;
  const t1 = t0 + knotInterval(p0, p1);
  const t2 = t1 + knotInterval(p1, p2);
  const t3 = t2 + knotInterval(p2, p3);
  const span = t2 - t1;

  const tangent1 = {
    x:
      span *
      ((p1.x - p0.x) / (t1 - t0) -
        (p2.x - p0.x) / (t2 - t0) +
        (p2.x - p1.x) / (t2 - t1)),
    y:
      span *
      ((p1.y - p0.y) / (t1 - t0) -
        (p2.y - p0.y) / (t2 - t0) +
        (p2.y - p1.y) / (t2 - t1)),
  };
  const tangent2 = {
    x:
      span *
      ((p2.x - p1.x) / (t2 - t1) -
        (p3.x - p1.x) / (t3 - t1) +
        (p3.x - p2.x) / (t3 - t2)),
    y:
      span *
      ((p2.y - p1.y) / (t2 - t1) -
        (p3.y - p1.y) / (t3 - t1) +
        (p3.y - p2.y) / (t3 - t2)),
  };

  return {
    control1: {
      x: p1.x + tangent1.x / 3,
      y: p1.y + tangent1.y / 3,
    },
    control2: {
      x: p2.x - tangent2.x / 3,
      y: p2.y - tangent2.y / 3,
    },
    end: p2,
  };
}

/** Catmull-Rom trace with distance-aware handles for uneven motion samples. */
export function traceCentripetalForward(
  ctx: CanvasRenderingContext2D,
  x: number[],
  y: number[],
  start: number,
  end: number,
  n: number
): void {
  ctx.moveTo(x[start]!, y[start]!);
  for (let index = start + 1; index <= end; index++) {
    appendCentripetalSegment(ctx, x, y, index - 1, index, n);
  }
}

/** Reverse centripetal edge trace. Continues the current closed ribbon path. */
export function traceCentripetalBackward(
  ctx: CanvasRenderingContext2D,
  x: number[],
  y: number[],
  start: number,
  end: number,
  n: number
): void {
  ctx.lineTo(x[end]!, y[end]!);
  for (let index = end - 1; index >= start; index--) {
    appendCentripetalSegment(ctx, x, y, index + 1, index, n);
  }
}

function appendCentripetalSegment(
  ctx: CanvasRenderingContext2D,
  x: number[],
  y: number[],
  from: number,
  to: number,
  n: number
): void {
  const direction = Math.sign(to - from) || 1;
  const segment = resolveCentripetalBezierSegment(
    pointAt(x, y, from - direction, n),
    pointAt(x, y, from, n),
    pointAt(x, y, to, n),
    pointAt(x, y, to + direction, n)
  );
  ctx.bezierCurveTo(
    segment.control1.x,
    segment.control1.y,
    segment.control2.x,
    segment.control2.y,
    segment.end.x,
    segment.end.y
  );
}

function pointAt(
  x: number[],
  y: number[],
  index: number,
  n: number
): RibbonTracePoint {
  if (index < 0) {
    return {
      x: x[0]! * 2 - x[Math.min(1, n - 1)]!,
      y: y[0]! * 2 - y[Math.min(1, n - 1)]!,
    };
  }
  if (index >= n) {
    return {
      x: x[n - 1]! * 2 - x[Math.max(0, n - 2)]!,
      y: y[n - 1]! * 2 - y[Math.max(0, n - 2)]!,
    };
  }
  return { x: x[index]!, y: y[index]! };
}

function knotInterval(a: RibbonTracePoint, b: RibbonTracePoint): number {
  const distance = Math.hypot(b.x - a.x, b.y - a.y);
  return Math.max(MIN_KNOT_INTERVAL, Math.sqrt(distance));
}
