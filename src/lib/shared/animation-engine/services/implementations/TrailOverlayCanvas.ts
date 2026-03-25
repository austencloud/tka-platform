/**
 * Trail Overlay Canvas
 *
 * Dedicated Canvas2D overlay for trail rendering. Instead of clearing and
 * redrawing every trail point each frame (as the main canvas does), this
 * accumulates trail pixels and fades them with the `destination-out`
 * composite operation. The result is smooth, natural trail decay that
 * preserves trails across sequence boundaries.
 *
 * Follows the same overlay pattern as WebGLFireRenderer and LedOverlayRenderer:
 * position: absolute, pointer-events: none, z-index: 1.
 */

import type {
  ITrailOverlayCanvas,
  TrailOverlayRenderParams,
} from "../contracts/ITrailOverlayCanvas";
import type { TrailPoint } from "../../domain/types/TrailTypes";
import { Canvas2DTrailRenderer } from "$lib/features/compose/services/implementations/canvas2d/Canvas2DTrailRenderer";

export class TrailOverlayCanvas implements ITrailOverlayCanvas {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private trailRenderer = new Canvas2DTrailRenderer();
  private width = 0;
  private height = 0;

  initialize(container: HTMLElement, width: number, height: number): void {
    this.dispose();

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.setAttribute("aria-hidden", "true");

    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "1";
    canvas.style.background = "transparent";

    container.appendChild(canvas);

    this.canvas = canvas;
    this.ctx = canvas.getContext("2d", { willReadFrequently: true });
    this.width = width;
    this.height = height;
  }

  resize(width: number, height: number): void {
    if (!this.canvas) return;

    // Setting canvas dimensions clears content. That's fine — trails
    // rebuild from the point cache on the next few frames.
    this.canvas.width = width;
    this.canvas.height = height;
    this.width = width;
    this.height = height;
  }

  renderFrame(params: TrailOverlayRenderParams): void {
    const ctx = this.ctx;
    if (!ctx) return;

    const {
      blueTrailPoints,
      redTrailPoints,
      trailSettings,
      deltaTime,
      canvasSize,
      hasBlue,
      hasRed,
      additionalLayers,
    } = params;

    // ---------------------------------------------------------------
    // 1. Fade existing content using destination-out
    //
    // destination-out erases pixels proportional to the drawn alpha.
    // By filling a rect with a small alpha each frame, existing trail
    // pixels lose a little opacity every frame, creating smooth decay.
    // The fill color is irrelevant — only the alpha channel matters.
    // ---------------------------------------------------------------
    const fadeAmount = this.computeFadeAmount(
      trailSettings.fadeDurationMs,
      deltaTime
    );

    ctx.save();
    ctx.globalCompositeOperation = "destination-out";

    // Pass 1: normal fade based on trail duration
    ctx.globalAlpha = fadeAmount;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.restore();

    // Kill ghost pixels: destination-out is multiplicative, so
    // alpha=1 * (1-x) rounds back to 1 for any x < 0.5 in 8-bit color.
    // No multiplier can fix this. Direct pixel manipulation is the only
    // way to force near-zero alpha to actual zero.
    this.killGhostPixels(ctx);

    // ---------------------------------------------------------------
    // 2. Draw new trail segments on top using source-over
    //
    // Canvas2DTrailRenderer handles spline interpolation, per-end
    // coloring, taper, glow, and additional tunnel layers.
    // ---------------------------------------------------------------
    // Draw the leading edge of the trail using the full-quality renderer
    // (Catmull-Rom splines, tapering) but with uniform opacity so the
    // overlay's destination-out is the sole source of the fade gradient.
    // Drawing the full window would compound brightness frame-over-frame.
    const LEADING_EDGE = 20;
    const blueLeading = this.sanitizeLeadingEdge(
      blueTrailPoints.length > LEADING_EDGE
        ? blueTrailPoints.slice(-LEADING_EDGE)
        : blueTrailPoints,
      canvasSize
    );
    const redLeading = this.sanitizeLeadingEdge(
      redTrailPoints.length > LEADING_EDGE
        ? redTrailPoints.slice(-LEADING_EDGE)
        : redTrailPoints,
      canvasSize
    );

    const overlaySettings = {
      ...trailSettings,
      glowBlur: 0,        // overlay accumulation creates natural glow
      minOpacity: 0.8,
      maxOpacity: 1.0,
    };

    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    this.trailRenderer.renderTrails(
      ctx,
      blueLeading,
      redLeading,
      overlaySettings,
      performance.now(),
      hasBlue,
      hasRed,
      canvasSize,
      undefined,
      additionalLayers?.map(layer => ({
        ...layer,
        blueTrailPoints: layer.blueTrailPoints.length > LEADING_EDGE
          ? layer.blueTrailPoints.slice(-LEADING_EDGE)
          : layer.blueTrailPoints,
        redTrailPoints: layer.redTrailPoints.length > LEADING_EDGE
          ? layer.redTrailPoints.slice(-LEADING_EDGE)
          : layer.redTrailPoints,
      }))
    );
    ctx.restore();
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  /**
   * Remove discontinuous points that would create artifacts.
   * During sequence swaps, stale cache data can produce points at wrong
   * positions. If two consecutive points are more than 30% of canvas size
   * apart, they're from different contexts — drop the earlier ones.
   */
  private sanitizeLeadingEdge(
    points: TrailPoint[],
    canvasSize: number
  ): TrailPoint[] {
    if (points.length < 2) return points;

    const maxGap = canvasSize * 0.3;
    const maxGapSq = maxGap * maxGap;

    // Walk backward from the newest point and find where continuity breaks
    for (let i = points.length - 1; i > 0; i--) {
      const curr = points[i]!;
      const prev = points[i - 1]!;
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      if (dx * dx + dy * dy > maxGapSq) {
        // Discontinuity — keep only points from i onward
        return points.slice(i);
      }
    }

    return points;
  }

  setVisible(visible: boolean): void {
    if (!this.canvas) return;
    this.canvas.style.display = visible ? "" : "none";
  }

  dispose(): void {
    if (this.canvas?.parentElement) {
      this.canvas.parentElement.removeChild(this.canvas);
    }
    this.canvas = null;
    this.ctx = null;
    this.width = 0;
    this.height = 0;
  }

  // -------------------------------------------------------------------
  // Delta-time compensated fade
  //
  // We want the trail to be fully transparent after `fadeDurationMs`
  // milliseconds. At 60 fps that's `fadeDurationMs / 16.67` frames.
  // A base fade of `1.5 / framesForFullFade` per frame gives a smooth
  // exponential decay. Delta-time compensation ensures consistent fade
  // speed regardless of actual frame rate.
  // -------------------------------------------------------------------
  private computeFadeAmount(fadeDurationMs: number, deltaTime: number): number {
    // Guard against nonsensical values
    const safeDuration = Math.max(fadeDurationMs, 16.67);
    const framesForFullFade = safeDuration / 16.67;
    // 3.5x multiplier ensures trails reach full transparency within the
    // fade window. Lower values (e.g., 1.5) cause exponential decay to
    // asymptote above zero, leaving permanent gray ghost artifacts.
    const baseFade = 3.5 / framesForFullFade;

    // deltaTime is in seconds (e.g. 0.0167 for 60fps). Multiply by 60
    // to normalize to "number of 60fps frames worth of time elapsed".
    return 1 - Math.pow(1 - baseFade, deltaTime * 60);
  }

  /**
   * Zero out pixels with alpha below threshold.
   * destination-out is multiplicative: alpha=1 * (1-x) rounds back to 1
   * for any x < 0.5 in 8-bit color. No multiplier fixes this.
   * Direct pixel manipulation is the only way to eliminate ghost artifacts.
   */
  private killGhostPixels(ctx: CanvasRenderingContext2D): void {
    const w = this.width;
    const h = this.height;
    if (w === 0 || h === 0) return;

    const imageData = ctx.getImageData(0, 0, w, h);
    const data = imageData.data;

    // With fade factor ~0.981, alpha * 0.981 rounds back to alpha for any
    // value below 27 (because N * 0.019 < 0.5 rounds to 0). These pixels
    // are permanently stuck and visible as gray on dark backgrounds.
    const threshold = 28;
    let dirty = false;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i]! > 0 && data[i]! < threshold) {
        data[i] = 0;
        dirty = true;
      }
    }

    if (dirty) {
      ctx.putImageData(imageData, 0, 0);
    }
  }
}
