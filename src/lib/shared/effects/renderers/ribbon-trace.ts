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
  n: number,
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
      y[i]!,
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
  n: number,
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
      y[i]!,
    );
  }
}
