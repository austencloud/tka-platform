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
    this.ctx = canvas.getContext("2d");
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
    ctx.globalAlpha = fadeAmount;
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.restore();

    // ---------------------------------------------------------------
    // 2. Draw new trail segments on top using source-over
    //
    // Canvas2DTrailRenderer handles spline interpolation, per-end
    // coloring, taper, glow, and additional tunnel layers.
    // ---------------------------------------------------------------
    ctx.save();
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1.0;
    this.trailRenderer.renderTrails(
      ctx,
      blueTrailPoints,
      redTrailPoints,
      trailSettings,
      performance.now(),
      hasBlue,
      hasRed,
      canvasSize,
      undefined,
      additionalLayers
    );
    ctx.restore();
  }

  clear(): void {
    if (!this.ctx) return;
    this.ctx.clearRect(0, 0, this.width, this.height);
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
    const baseFade = 1.5 / framesForFullFade;

    // deltaTime is in seconds (e.g. 0.0167 for 60fps). Multiply by 60
    // to normalize to "number of 60fps frames worth of time elapsed".
    return 1 - Math.pow(1 - baseFade, deltaTime * 60);
  }
}
